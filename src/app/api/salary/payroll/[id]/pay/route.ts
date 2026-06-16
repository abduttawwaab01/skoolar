import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canMarkPayrollPaid } from '@/lib/salary-utils/permissions';
import { generatePayrollNotifications } from '@/lib/salary-utils/notifications';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canMarkPayrollPaid(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const payroll = await db.payroll.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!payroll) {
      return errorResponse('Payroll not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && payroll.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    if (payroll.status !== 'APPROVED') {
      return errorResponse('Only APPROVED payrolls can be marked as paid', 400);
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.payroll.update({
        where: { id: id },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });

      await tx.payslip.updateMany({
        where: { payrollId: id },
        data: {
          paymentStatus: 'PAID',
          paidAt: now,
        },
      });

      const expenseRecords = payroll.payslips.map((p) => ({
        schoolId: payroll.schoolId,
        title: `Salary - ${p.user?.name || 'Staff'} - ${payroll.title}`,
        amount: p.netPay,
        category: 'Salary',
        date: now,
        status: 'paid',
        paidTo: p.user?.name || null,
      }));

      if (expenseRecords.length > 0) {
        await tx.expense.createMany({
          data: expenseRecords,
        });
      }
    });

    const recipientIds = [...new Set(payroll.payslips.map((p) => p.userId))];
    const notifications = recipientIds.map((userId) => {
      const payslip = payroll.payslips.find((p) => p.userId === userId);
      return generatePayrollNotifications({
        type: 'salary_paid',
        userId,
        payrollTitle: payroll.title,
        amount: payslip?.netPay,
      });
    });

    if (notifications.length > 0) {
      await db.notification.createMany({
        data: notifications.map((n) => ({
          userId: n.userId,
          title: n.title,
          message: n.message,
          type: 'PAYROLL',
        })),
      });
    }

    const updated = await db.payroll.findUnique({
      where: { id: id },
    });

    return successResponse(updated, 'Payroll marked as paid successfully');
  } catch (error: any) {
    console.error('[POST /api/salary/payroll/:id/pay]', error);
    return errorResponse(error.message, 500);
  }
}
