import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewAllPayslips, canViewOwnPayslips } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const payslip = await db.payslip.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        payroll: { select: { id: true, title: true, month: true, year: true, status: true } },
      },
    });

    if (!payslip) {
      return errorResponse('Payslip not found', 404);
    }

    const canViewAll = canViewAllPayslips(auth.role);
    const canViewOwn = canViewOwnPayslips(auth.role);
    const isOwn = payslip.userId === auth.userId;

    if (!canViewAll && !(canViewOwn && isOwn)) {
      return errorResponse('Insufficient permissions', 403);
    }

    if (!canViewAll) {
      const schoolId = getSchoolId(request, auth);
      if (schoolId && payslip.schoolId !== schoolId) {
        return errorResponse('Access denied', 403);
      }
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (format === 'pdf') {
      return successResponse(payslip);
    }

    return successResponse(payslip);
  } catch (error: any) {
    console.error('[GET /api/salary/payslips/:id]', error);
    return errorResponse(error.message, 500);
  }
}
