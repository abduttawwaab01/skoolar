import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canManageSalaryConfig } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const UpdateSchema = z.object({
  role: z.enum(['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'DIRECTOR', 'SCHOOL_ADMIN']).optional(),
  baseSalary: z.number().positive().optional(),
  housingAllowance: z.number().min(0).optional(),
  transportAllowance: z.number().min(0).optional(),
  medicalAllowance: z.number().min(0).optional(),
  bonus: z.number().min(0).optional(),
  otherAllowances: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  pensionNumber: z.string().optional().nullable(),
  effectiveDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canManageSalaryConfig(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const record = await db.staffSalary.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!record) {
      return errorResponse('Staff salary not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && record.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    return successResponse(record);
  } catch (error: any) {
    console.error('[GET /api/salary/config/:id]', error);
    return errorResponse(error.message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canManageSalaryConfig(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const record = await db.staffSalary.findUnique({
      where: { id },
    });

    if (!record) {
      return errorResponse('Staff salary not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && record.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    const body = await request.json();
    const validation = UpdateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const updated = await db.staffSalary.update({
      where: { id: id },
      data: validation.data,
    });

    return successResponse(updated, 'Staff salary updated successfully');
  } catch (error: any) {
    console.error('[PUT /api/salary/config/:id]', error);
    return errorResponse(error.message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canManageSalaryConfig(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  const { id } = await params;

  try {
    const record = await db.staffSalary.findUnique({
      where: { id },
    });

    if (!record) {
      return errorResponse('Staff salary not found', 404);
    }

    const schoolId = getSchoolId(request, auth);
    if (schoolId && record.schoolId !== schoolId) {
      return errorResponse('Access denied', 403);
    }

    await db.staffSalary.update({
      where: { id: id },
      data: { isActive: false },
    });

    return successResponse(null, 'Staff salary deactivated successfully');
  } catch (error: any) {
    console.error('[DELETE /api/salary/config/:id]', error);
    return errorResponse(error.message, 500);
  }
}
