import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const question = await db.teacherAssessmentQuestion.update({ where: { id }, data: body });
    return successResponse(question, 'Question updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    await db.teacherAssessmentQuestion.delete({ where: { id } });
    return successResponse(null, 'Question deleted');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
