import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const assessment = await db.studentAssessment.findFirst({
      where: { id, schoolId: ctx.schoolId, deletedAt: null },
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { attempts: true, results: true } },
      },
    });

    if (!assessment) return errorResponse('Assessment not found', 404);
    return assessment;
  }, req);

export const PATCH = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();

    const assessment = await db.studentAssessment.update({
      where: { id, schoolId: ctx.schoolId },
      data: body,
    });

    return successResponse(assessment, 'Assessment updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
