import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { canViewOwnConfig } from '@/lib/salary-utils/permissions';
import { errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!canViewOwnConfig(auth.role)) {
    return errorResponse('Insufficient permissions', 403);
  }

  try {
    const salary = await db.staffSalary.findUnique({
      where: { userId: auth.userId! },
    });

    if (!salary) {
      return errorResponse('Salary configuration not found', 404);
    }

    return successResponse(salary);
  } catch (error: any) {
    console.error('[GET /api/salary/my]', error);
    return errorResponse(error.message, 500);
  }
}
