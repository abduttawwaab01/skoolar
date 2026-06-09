import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const recId = (await params).id;
    const rec = await db.teacherDevelopmentRecommendation.update({
      where: { id: recId },
      data: { completedAt: new Date() },
    });
    return successResponse(rec, 'Development activity marked complete');
  }, req);
