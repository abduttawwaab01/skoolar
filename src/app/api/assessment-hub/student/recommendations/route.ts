import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, getPaginationParams } from '@/lib/api-helpers';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const studentId = searchParams.get('studentId') || '';
    const isCompleted = searchParams.get('isCompleted') || '';
    const priority = searchParams.get('priority') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (studentId) where.studentId = studentId;
    if (isCompleted) where.isCompleted = isCompleted === 'true';
    if (priority) where.priority = priority;

    if (ctx.auth.role === 'STUDENT') {
      const student = await db.student.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (student) where.studentId = student.id;
    }

    const [data, total] = await Promise.all([
      db.studentRecommendation.findMany({
        where: where as any, skip: (page - 1) * limit, take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
      db.studentRecommendation.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
