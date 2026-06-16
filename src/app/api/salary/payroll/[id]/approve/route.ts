import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canApprovePayroll } from '@/lib/salary-utils/permissions';
import { generatePayrollNotifications } from '@/lib/salary-utils/notifications';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canApprovePayroll(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const payroll = await db.payroll.findUnique({
      where: { id },
      include: {
        payslips: { select: { userId: true } },
      },
    });

    if (!payroll) {
      return errorResponse('Payroll not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && payroll.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    if (payroll.status !== 'DRAFT') {
      return errorResponse('Only DRAFT payrolls can be approved', 400);
    }

    const updated = await db.payroll.update({
      where: { id: id },
      data: {
        status: 'APPROVED',
        approvedById: auth.userId!,
        approvedAt: new Date(),
      },
    });

    const recipientIds = [...new Set(payroll.payslips.map((p) => p.userId))];

    const notifications = recipientIds.map((userId) =>
      generatePayrollNotifications({
        type: 'payroll_approved',
        userId,
        payrollTitle: payroll.title,
      })
    );

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

    return successResponse(updated, 'Payroll approved successfully');
  } catch (error: any) {
    console.error('[POST /api/salary/payroll/:id/approve]', error);
    return errorResponse(error.message, 500);
  }
}
