import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewPayrolls, canCreatePayroll } from '@/lib/salary-utils/permissions';
import { calculateSalary } from '@/lib/salary-utils/calculations';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const CreatePayrollSchema = z.object({
  title: z.string().min(1).max(255),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewPayrolls(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const status = searchParams.get('status') || '';
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : getSchoolId(request, auth);

    const where: any = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (status) where.status = status;
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const data = await db.payroll.findMany({
      where,
      include: {
        _count: { select: { payslips: true } },
        processedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const records = data.map((p) => ({
      ...p,
      staffCount: p.staffCount || p._count.payslips,
    }));

    return successResponse(records);
  } catch (error: any) {
    console.error('[GET /api/salary/payroll]', error);
    return errorResponse(error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canCreatePayroll(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const body = await request.json();
    const validation = CreatePayrollSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const data = validation.data;
    const schoolId = getSchoolId(request, auth) || body.schoolId;

    if (!schoolId) {
      return errorResponse('School context required', 403);
    }

    if (body.schoolId && body.schoolId !== auth.schoolId && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('Access denied', 403);
    }

    const existingPayroll = await db.payroll.findUnique({
      where: { schoolId_year_month: { schoolId, year: data.year, month: data.month } },
    });
    if (existingPayroll) {
      return errorResponse('Payroll already exists for this period', 409);
    }

    const activeStaff = await db.staffSalary.findMany({
      where: { schoolId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (activeStaff.length === 0) {
      return errorResponse('No active staff salary configurations found', 400);
    }

    const advanceDeductionsPromises = activeStaff.map((staff) =>
      db.salaryAdvance.findMany({
        where: {
          userId: staff.userId,
          status: { in: ['APPROVED', 'PAID'] },
          remainingBalance: { gt: 0 },
        },
        select: { monthlyDeduction: true, amount: true, remainingBalance: true },
      })
    );
    const allAdvanceDeductions = await Promise.all(advanceDeductionsPromises);

    let totalGrossPay = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    const payslipData: any[] = [];

    for (let i = 0; i < activeStaff.length; i++) {
      const staff = activeStaff[i];
      const advances = allAdvanceDeductions[i];

      const advDeductions = advances.map((a) => ({ amount: a.monthlyDeduction }));

      const calculated = calculateSalary({
        baseSalary: staff.baseSalary,
        housingAllowance: staff.housingAllowance,
        transportAllowance: staff.transportAllowance,
        medicalAllowance: staff.medicalAllowance,
        bonus: staff.bonus,
        otherAllowances: staff.otherAllowances,
        advanceDeductions: advDeductions,
      });

      totalGrossPay += calculated.grossPay;
      totalDeductions += calculated.totalDeductions;
      totalNetPay += calculated.netPay;

      payslipData.push({
        userId: staff.userId,
        schoolId,
        role: staff.role,
        baseSalary: staff.baseSalary,
        housingAllowance: staff.housingAllowance,
        transportAllowance: staff.transportAllowance,
        medicalAllowance: staff.medicalAllowance,
        bonus: staff.bonus,
        otherAllowances: staff.otherAllowances,
        grossPay: calculated.grossPay,
        deductions: JSON.stringify(calculated.deductions),
        totalDeductions: calculated.totalDeductions,
        netPay: calculated.netPay,
      });
    }

    const payroll = await db.payroll.create({
      data: {
        schoolId,
        title: data.title,
        month: data.month,
        year: data.year,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        totalGrossPay,
        totalDeductions,
        totalNetPay,
        staffCount: activeStaff.length,
        notes: data.notes,
        processedById: auth.userId!,
        payslips: {
          createMany: {
            data: payslipData,
          },
        },
      },
      include: {
        payslips: true,
      },
    });

    return successResponse(payroll, 'Payroll created successfully', 201);
  } catch (error: any) {
    console.error('[POST /api/salary/payroll]', error);
    return errorResponse(error.message, 500);
  }
}
