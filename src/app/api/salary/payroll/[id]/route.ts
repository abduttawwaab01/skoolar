import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewPayrolls, canCreatePayroll } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const UpdateNotesSchema = z.object({
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewPayrolls(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const payroll = await db.payroll.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        processedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!payroll) {
      return errorResponse('Payroll not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && payroll.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    return successResponse(payroll);
  } catch (error: any) {
    console.error('[GET /api/salary/payroll/:id]', error);
    return errorResponse(error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canCreatePayroll(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const payroll = await db.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return errorResponse('Payroll not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && payroll.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    if (payroll.status !== 'DRAFT') {
      return errorResponse('Only DRAFT payrolls can be updated', 400);
    }

    const body = await request.json();
    const validation = UpdateNotesSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const updated = await db.payroll.update({
      where: { id: id },
      data: { notes: validation.data.notes },
    });

    return successResponse(updated, 'Payroll updated successfully');
  } catch (error: any) {
    console.error('[PUT /api/salary/payroll/:id]', error);
    return errorResponse(error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canCreatePayroll(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const payroll = await db.payroll.findUnique({
      where: { id },
    });

    if (!payroll) {
      return errorResponse('Payroll not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && payroll.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    if (payroll.status !== 'DRAFT') {
      return errorResponse('Only DRAFT payrolls can be deleted', 400);
    }

    await db.payslip.deleteMany({ where: { payrollId: id } });
    await db.payroll.delete({ where: { id: id } });

    return successResponse(null, 'Payroll deleted successfully');
  } catch (error: any) {
    console.error('[DELETE /api/salary/payroll/:id]', error);
    return errorResponse(error.message, 500);
  }
}
