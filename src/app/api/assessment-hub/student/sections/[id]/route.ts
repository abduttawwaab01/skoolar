import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';
import { StudentSectionUpdateSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const validation = validateSchema(StudentSectionUpdateSchema, body);
    if (!validation.valid) return validation.error;

    const section = await db.studentAssessmentSection.update({ where: { id }, data: validation.data });
    return successResponse(section, 'Section updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    await db.studentAssessmentSection.delete({ where: { id } });
    return successResponse(null, 'Section deleted');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
