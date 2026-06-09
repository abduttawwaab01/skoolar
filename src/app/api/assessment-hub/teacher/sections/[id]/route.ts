import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const section = await db.teacherAssessmentSection.update({ where: { id }, data: body });
    return successResponse(section, 'Section updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    await db.teacherAssessmentSection.delete({ where: { id } });
    return successResponse(null, 'Section deleted');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
