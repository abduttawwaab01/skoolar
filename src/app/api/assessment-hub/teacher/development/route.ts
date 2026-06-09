import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, getPaginationParams } from '@/lib/api-helpers';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const teacherId = searchParams.get('teacherId') || '';
    const priority = searchParams.get('priority') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (teacherId) where.teacherId = teacherId;
    if (priority) where.priority = priority;

    if (ctx.auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (teacher) where.teacherId = teacher.id;
    }

    const [data, total] = await Promise.all([
      db.teacherDevelopmentRecommendation.findMany({
        where: where as any, skip: (page - 1) * limit, take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
      db.teacherDevelopmentRecommendation.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
