import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, getPaginationParams } from '@/lib/api-helpers';
import { StudentAssessmentCreateSchema, StudentAssessmentUpdateSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId, deletedAt: null };
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    if (ctx.auth.role === 'STUDENT') {
      where.status = 'published';
      const student = await db.student.findUnique({ where: { userId: ctx.userId }, select: { id: true, classId: true } });
      if (student) {
        where.OR = [
          { targetScope: 'all_students' },
          { targetClassIds: { contains: student.classId || '' } },
          { targetStudentIds: { contains: student.id } },
        ];
      }
    }

    const [data, total] = await Promise.all([
      db.studentAssessment.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { sections: { orderBy: { order: 'asc' } }, _count: { select: { questions: true, attempts: true } } },
      }),
      db.studentAssessment.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(StudentAssessmentCreateSchema, body);
    if (!validation.valid) return validation.error;

    const assessment = await db.studentAssessment.create({
      data: { ...validation.data, schoolId: ctx.schoolId, createdBy: ctx.userId },
    });

    return successResponse(assessment, 'Assessment created successfully', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const PUT = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return errorResponse('Assessment ID is required');

    const validation = validateSchema(StudentAssessmentUpdateSchema, data);
    if (!validation.valid) return validation.error;

    const assessment = await db.studentAssessment.update({
      where: { id, schoolId: ctx.schoolId },
      data: validation.data,
    });

    return successResponse(assessment, 'Assessment updated successfully');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const DELETE = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('Assessment ID is required');

    await db.studentAssessment.update({
      where: { id, schoolId: ctx.schoolId },
      data: { deletedAt: new Date() },
    });

    return successResponse(null, 'Assessment deleted successfully');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
