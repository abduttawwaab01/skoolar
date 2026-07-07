import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, getPaginationParams } from '@/lib/api-helpers';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const assessmentId = searchParams.get('assessmentId') || '';
    const studentId = searchParams.get('studentId') || '';
    const domain = searchParams.get('domain') || '';

    const where: Record<string, unknown> = { student: { schoolId: ctx.schoolId } };
    if (assessmentId) where.assessmentId = assessmentId;
    if (studentId) where.studentId = studentId;
    if (domain) where.domain = domain;

    if (ctx.auth.role === 'STUDENT') {
      const student = await db.student.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (student) where.studentId = student.id;
    }

    const [data, total] = await Promise.all([
      db.studentDomainResult.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assessment: { select: { name: true, type: true } },
          attempt: { select: { status: true, submittedAt: true } },
        },
      }),
      db.studentDomainResult.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
