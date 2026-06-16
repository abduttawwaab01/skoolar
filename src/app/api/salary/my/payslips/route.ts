import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { canViewOwnPayslips } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewOwnPayslips(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where = { userId: auth.userId! };

    const [data, total] = await Promise.all([
      db.payslip.findMany({
        where,
        include: {
          payroll: { select: { id: true, title: true, month: true, year: true, status: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.payslip.count({ where }),
    ]);

    return successResponse({
      records: data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('[GET /api/salary/my/payslips]', error);
    return errorResponse(error.message, 500);
  }
}
