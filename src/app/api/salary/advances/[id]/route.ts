import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canRequestAdvance, canApproveAdvance, canViewAdvances } from '@/lib/salary-utils/permissions';
import { generatePayrollNotifications } from '@/lib/salary-utils/notifications';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const UpdateAdvanceSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().max(1000).optional().nullable(),
  repaymentMonths: z.number().int().min(1).max(24).optional(),
});

const ApproveRejectSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewAdvances(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const advance = await db.salaryAdvance.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!advance) {
      return errorResponse('Advance not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && advance.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    return successResponse(advance);
  } catch (error: any) {
    console.error('[GET /api/salary/advances/:id]', error);
    return errorResponse(error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const advance = await db.salaryAdvance.findUnique({
      where: { id },
    });

    if (!advance) {
      return errorResponse('Advance not found', 404);
    }

    if (advance.userId !== auth.userId) {
      return errorResponse('Access denied', 403);
    }

    if (advance.status !== 'PENDING') {
      return errorResponse('Only PENDING advances can be edited', 400);
    }

    const body = await request.json();
    const validation = UpdateAdvanceSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const updateData: any = { ...validation.data };

    if (updateData.amount && updateData.repaymentMonths) {
      updateData.monthlyDeduction = Math.round((updateData.amount / updateData.repaymentMonths) * 100) / 100;
      updateData.remainingBalance = updateData.amount;
    } else if (updateData.amount) {
      updateData.monthlyDeduction = Math.round((updateData.amount / advance.repaymentMonths) * 100) / 100;
      updateData.remainingBalance = updateData.amount;
    } else if (updateData.repaymentMonths) {
      updateData.monthlyDeduction = Math.round((advance.amount / updateData.repaymentMonths) * 100) / 100;
    }

    const updated = await db.salaryAdvance.update({
      where: { id: id },
      data: updateData,
    });

    return successResponse(updated, 'Advance updated successfully');
  } catch (error: any) {
    console.error('[PUT /api/salary/advances/:id]', error);
    return errorResponse(error.message, 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canApproveAdvance(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = ApproveRejectSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const advance = await db.salaryAdvance.findUnique({
      where: { id: id },
    });

    if (!advance) {
      return errorResponse('Advance not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && advance.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    if (advance.status !== 'PENDING') {
      return errorResponse('Only PENDING advances can be approved or rejected', 400);
    }

    const { action, rejectionReason } = validation.data;

    if (action === 'approve') {
      const updated = await db.salaryAdvance.update({
        where: { id: id },
        data: {
          status: 'APPROVED',
          approvedById: auth.userId!,
          approvedAt: new Date(),
        },
      });

      const notification = generatePayrollNotifications({
        type: 'advance_approved',
        userId: advance.userId,
        amount: advance.amount,
      });

      await db.notification.create({
        data: {
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          type: 'ADVANCE',
        },
      });

      return successResponse(updated, 'Advance approved successfully');
    } else {
      const updated = await db.salaryAdvance.update({
        where: { id: id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || null,
          approvedById: auth.userId!,
          approvedAt: new Date(),
        },
      });

      const notification = generatePayrollNotifications({
        type: 'advance_rejected',
        userId: advance.userId,
        amount: advance.amount,
      });

      await db.notification.create({
        data: {
          userId: notification.userId,
          title: notification.title,
          message: notification.message,
          type: 'ADVANCE',
        },
      });

      return successResponse(updated, 'Advance rejected successfully');
    }
  } catch (error: any) {
    console.error('[POST /api/salary/advances/:id]', error);
    return errorResponse(error.message, 500);
  }
}
