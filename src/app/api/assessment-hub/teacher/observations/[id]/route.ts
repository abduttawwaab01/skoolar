import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const observation = await db.teacherObservationRecord.update({ where: { id }, data: body });
    return successResponse(observation, 'Observation updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR']);
