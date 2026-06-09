import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { TeacherQuestionCreateSchema } from '@/lib/validators/assessment';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    if (Array.isArray(body)) {
      const results: any[] = [];
      for (const item of body) {
        const validation = validateSchema(TeacherQuestionCreateSchema, item);
        if (!validation.valid) return validation.error;
        const create = db.teacherAssessmentQuestion.create as any;
        results.push(await create({ data: validation.data }));
      }
      return successResponse(results, `${results.length} questions created`, 201);
    }
    const validation = validateSchema(TeacherQuestionCreateSchema, body);
    if (!validation.valid) return validation.error;
    const create = db.teacherAssessmentQuestion.create as any;
    const question = await create({ data: validation.data });
    return successResponse(question, 'Question created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
