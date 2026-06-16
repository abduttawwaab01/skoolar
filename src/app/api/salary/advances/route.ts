import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSchoolId } from '@/lib/auth-middleware';
import { canViewAdvances, canRequestAdvance } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';
import { z } from 'zod';

const AdvanceCreateSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().max(1000).optional().nullable(),
  repaymentMonths: z.number().int().min(1).max(24).default(1),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewAdvances(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const status = searchParams.get('status') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : getSchoolId(request, auth);

    const where: any = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (status) where.status = status;

    const data = await db.salaryAdvance.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(data);
  } catch (error: any) {
    console.error('[GET /api/salary/advances]', error);
    return errorResponse(error.message, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canRequestAdvance(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const body = await request.json();
    const validation = AdvanceCreateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const data = validation.data;
    const schoolId = getSchoolId(request, auth);

    if (!schoolId) {
      return errorResponse('School context required', 403);
    }

    const monthlyDeduction = data.amount / data.repaymentMonths;

    const advance = await db.salaryAdvance.create({
      data: {
        schoolId,
        userId: auth.userId!,
        amount: data.amount,
        reason: data.reason,
        repaymentMonths: data.repaymentMonths,
        monthlyDeduction: Math.round(monthlyDeduction * 100) / 100,
        remainingBalance: data.amount,
        status: 'PENDING',
      },
    });

    return successResponse(advance, 'Advance request submitted successfully', 201);
  } catch (error: any) {
    console.error('[POST /api/salary/advances]', error);
    return errorResponse(error.message, 500);
  }
}
