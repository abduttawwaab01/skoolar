import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, errorResponse, getPaginationParams } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ teacherId: string }> }) =>
  apiHandler(async (ctx) => {
    const teacherId = (await params).teacherId;
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);

    const [data, total] = await Promise.all([
      db.teacher360FeedbackEntry.findMany({
        where: { teacherId, schoolId: ctx.schoolId, approvalStatus: 'approved' },
        skip: (page - 1) * limit, take: limit,
        orderBy: { submittedAt: 'desc' },
      }),
      db.teacher360FeedbackEntry.count({ where: { teacherId, schoolId: ctx.schoolId, approvalStatus: 'approved' } }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
