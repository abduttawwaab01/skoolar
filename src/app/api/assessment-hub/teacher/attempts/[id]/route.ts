import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, errorResponse } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const attempt = await db.teacherAssessmentAttempt.findFirst({
      where: { id, schoolId: ctx.schoolId },
      include: { assessment: { include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } } } } },
    });
    if (!attempt) return errorResponse('Attempt not found', 404);
    return attempt;
  }, req);
