import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, getPaginationParams, validateSchema } from '@/lib/api-helpers';
import { TeacherAttemptStartSchema } from '@/lib/validators/assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(TeacherAttemptStartSchema, body);
    if (!validation.valid) return validation.error;

    const existing = await db.teacherAssessmentAttempt.findUnique({
      where: { assessmentId_teacherId: { assessmentId: validation.data.assessmentId, teacherId: validation.data.teacherId } },
    });
    if (existing) return errorResponse('Attempt already exists', 409);

    const attempt = await db.teacherAssessmentAttempt.create({
      data: {
        assessmentId: validation.data.assessmentId,
        teacherId: validation.data.teacherId,
        schoolId: ctx.schoolId,
        status: 'in_progress',
      },
    });
    return successResponse(attempt, 'Attempt started', 201);
  }, req);

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const assessmentId = searchParams.get('assessmentId') || '';
    const teacherId = searchParams.get('teacherId') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (assessmentId) where.assessmentId = assessmentId;
    if (teacherId) where.teacherId = teacherId;

    const [data, total] = await Promise.all([
      db.teacherAssessmentAttempt.findMany({
        where: where as any, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { assessment: { select: { name: true, type: true } } },
      }),
      db.teacherAssessmentAttempt.count({ where: where as any }),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
