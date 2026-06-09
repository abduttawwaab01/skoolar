import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, getPaginationParams, validateSchema } from '@/lib/api-helpers';
import { TeacherAssessmentCreateSchema, TeacherAssessmentUpdateSchema } from '@/lib/validators/assessment';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const teacherId = searchParams.get('teacherId') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId, deletedAt: null };
    if (type) where.type = type;
    if (status) where.status = status;

    if (ctx.auth.role === 'TEACHER') {
      where.status = 'published';
      const teacher = await db.teacher.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (teacher) {
        const targetIds = { contains: teacher.id };
        where.OR = [{ targetTeacherIds: null }, { targetTeacherIds: targetIds }];
      }
    }

    const [data, total] = await Promise.all([
      db.teacherAssessment.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { sections: { orderBy: { order: 'asc' } }, _count: { select: { taQuestions: true, attempts: true } } },
      }),
      db.teacherAssessment.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(TeacherAssessmentCreateSchema, body);
    if (!validation.valid) return validation.error;

    const assessment = await db.teacherAssessment.create({
      data: { ...validation.data, schoolId: ctx.schoolId, createdBy: ctx.userId },
    });

    return successResponse(assessment, 'Teacher assessment created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const DELETE = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('Assessment ID is required');
    await db.teacherAssessment.update({ where: { id, schoolId: ctx.schoolId }, data: { deletedAt: new Date() } });
    return successResponse(null, 'Assessment deleted');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
