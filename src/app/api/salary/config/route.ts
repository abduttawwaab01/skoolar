import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewSalaryConfig, canManageSalaryConfig } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const StaffSalarySchema = z.object({
  schoolId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR', 'SCHOOL_ADMIN']),
  baseSalary: z.number().positive(),
  housingAllowance: z.number().min(0).optional().default(0),
  transportAllowance: z.number().min(0).optional().default(0),
  medicalAllowance: z.number().min(0).optional().default(0),
  bonus: z.number().min(0).optional().default(0),
  otherAllowances: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  pensionNumber: z.string().optional().nullable(),
  effectiveDate: z.coerce.date(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewSalaryConfig(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : getSchoolId(request, auth);

    const where: any = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;

    const data = await db.staffSalary.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(data);
  } catch (error: any) {
    console.error('[GET /api/salary/config]', error);
    return errorResponse(error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canManageSalaryConfig(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const body = await request.json();
    const validation = StaffSalarySchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const data = validation.data;

    if (data.schoolId !== auth.schoolId && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('Access denied', 403);
    }

    const existing = await db.staffSalary.findUnique({
      where: { userId: data.userId },
    });
    if (existing) {
      return errorResponse('Staff salary configuration already exists for this user', 409);
    }

    const record = await db.staffSalary.create({
      data: {
        ...data,
        createdById: auth.userId!,
      },
    });

    return successResponse(record, 'Staff salary created successfully', 201);
  } catch (error: any) {
    console.error('[POST /api/salary/config]', error);
    return errorResponse(error.message, 500);
  }
}
