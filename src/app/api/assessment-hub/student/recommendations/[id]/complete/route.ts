import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const rec = await db.studentRecommendation.update({
      where: { id },
      data: { isCompleted: true, completedAt: new Date() },
    });
    return successResponse(rec, 'Recommendation marked as completed');
  }, req);
