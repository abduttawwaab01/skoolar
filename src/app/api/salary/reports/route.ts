import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewSalaryReports } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewSalaryReports(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : getSchoolId(request, auth);

    const schoolFilter = targetSchoolId ? { schoolId: targetSchoolId } : {};

    const totalStaff = await db.staffSalary.count({
      where: { ...schoolFilter, isActive: true },
    });

    const totalPayrolls = await db.payroll.count({
      where: schoolFilter,
    });

    const lastPayroll = await db.payroll.findFirst({
      where: schoolFilter,
      orderBy: { createdAt: 'desc' },
    });

    const pendingAdvances = await db.salaryAdvance.count({
      where: { ...schoolFilter, status: 'PENDING' },
    });

    const monthlySpend = lastPayroll ? lastPayroll.totalNetPay : 0;

    const payrollsByStatus = await db.payroll.groupBy({
      by: ['status'],
      where: schoolFilter,
      _count: { id: true },
    });

    const payrollByStatus: Record<string, number> = {};
    for (const item of payrollsByStatus) {
      payrollByStatus[item.status] = item._count.id;
    }

    const staffRecords = await db.staffSalary.findMany({
      where: { ...schoolFilter, isActive: true },
      select: { role: true },
    });

    const roleBreakdown: Record<string, number> = {};
    for (const staff of staffRecords) {
      roleBreakdown[staff.role] = (roleBreakdown[staff.role] || 0) + 1;
    }

    return successResponse({
      totalStaff,
      totalPayrolls,
      lastPayroll,
      pendingAdvances,
      monthlySpend,
      payrollByStatus,
      roleBreakdown,
    });
  } catch (error: any) {
    console.error('[GET /api/salary/reports]', error);
    return errorResponse(error.message, 500);
  }
}
