import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, getPaginationParams, validateSchema } from '@/lib/api-helpers';
import { ObservationCreateSchema } from '@/lib/validators/assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(ObservationCreateSchema, body);
    if (!validation.valid) return validation.error;

    const observation = await (db.teacherObservationRecord.create as any)({
      data: {
        ...validation.data,
        date: (validation.data as any).date ? new Date((validation.data as any).date) : new Date(),
        schoolId: ctx.schoolId,
        observerId: ctx.userId,
      },
    });

    return successResponse(observation, 'Observation recorded', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR']);

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const teacherId = searchParams.get('teacherId') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (teacherId) where.teacherId = teacherId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      db.teacherObservationRecord.findMany({
        where: where as any, skip: (page - 1) * limit, take: limit,
        orderBy: { date: 'desc' },
        include: { teacher: { select: { id: true, user: { select: { name: true } } } } },
      }),
      db.teacherObservationRecord.count({ where: where as any }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR']);
