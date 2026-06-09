import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { TeacherSectionCreateSchema } from '@/lib/validators/assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(TeacherSectionCreateSchema, body);
    if (!validation.valid) return validation.error;
    const section = await db.teacherAssessmentSection.create({ data: validation.data });
    return successResponse(section, 'Section created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
