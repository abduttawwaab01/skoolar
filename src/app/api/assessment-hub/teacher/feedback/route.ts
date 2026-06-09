import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, getPaginationParams, validateSchema } from '@/lib/api-helpers';
import { FeedbackSubmitSchema } from '@/lib/validators/assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(FeedbackSubmitSchema, body);
    if (!validation.valid) return validation.error;

    // Students can only give feedback if they belong to the teacher's class
    if (validation.data.respondentRole === 'student') {
      const student = await db.student.findUnique({ where: { userId: ctx.userId }, select: { id: true, classId: true } });
      if (!student) return errorResponse('Student not found', 404);
    }

    const feedback = await db.teacher360FeedbackEntry.create({
      data: {
        ...validation.data,
        schoolId: ctx.schoolId,
        respondentUserId: ctx.userId,
      },
    });

    return successResponse(feedback, 'Feedback submitted', 201);
  }, req);

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const teacherId = searchParams.get('teacherId') || '';
    const respondentRole = searchParams.get('respondentRole') || '';
    const approvalStatus = searchParams.get('approvalStatus') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (teacherId) where.teacherId = teacherId;
    if (respondentRole) where.respondentRole = respondentRole;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    if (ctx.auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (teacher) where.teacherId = teacher.id;
    }

    const [data, total] = await Promise.all([
      db.teacher360FeedbackEntry.findMany({
        where: where as any, skip: (page - 1) * limit, take: limit,
        orderBy: { submittedAt: 'desc' },
        include: { assessment: { select: { name: true, type: true } } },
      }),
      db.teacher360FeedbackEntry.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'DIRECTOR']);
