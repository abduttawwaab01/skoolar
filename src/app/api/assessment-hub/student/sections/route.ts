import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';
import { StudentSectionCreateSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(StudentSectionCreateSchema, body);
    if (!validation.valid) return validation.error;

    const section = await db.studentAssessmentSection.create({ data: validation.data });
    return successResponse(section, 'Section created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
