import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { canRequestAdvance } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canRequestAdvance(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const data = await db.salaryAdvance.findMany({
      where: { userId: auth.userId! },
      include: {
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(data);
  } catch (error: any) {
    console.error('[GET /api/salary/my/advances]', error);
    return errorResponse(error.message, 500);
  }
}
