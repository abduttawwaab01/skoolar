import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, getPaginationParams } from '@/lib/api-helpers';
import { StudentAttemptStartSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';
import { gradeObjectiveAnswer } from '@/lib/assessment-engine';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(StudentAttemptStartSchema, body);
    if (!validation.valid) return validation.error;

    const existing = await db.studentAssessmentAttempt.findUnique({
      where: { assessmentId_studentId: { assessmentId: validation.data.assessmentId, studentId: validation.data.studentId } },
    });
    if (existing) return errorResponse('Attempt already exists for this student', 409);

    const assessment = await db.studentAssessment.findUnique({
      where: { id: validation.data.assessmentId },
      select: { status: true, maxDuration: true },
    });
    if (!assessment || assessment.status !== 'published') return errorResponse('Assessment is not available', 400);

    const attempt = await db.studentAssessmentAttempt.create({
      data: {
        assessmentId: validation.data.assessmentId,
        studentId: validation.data.studentId,
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
    const studentId = searchParams.get('studentId') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (assessmentId) where.assessmentId = assessmentId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    if (ctx.auth.role === 'STUDENT') {
      const student = await db.student.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (student) where.studentId = student.id;
    }

    const [data, total] = await Promise.all([
      db.studentAssessmentAttempt.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { assessment: { select: { name: true, type: true } } },
      }),
      db.studentAssessmentAttempt.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
