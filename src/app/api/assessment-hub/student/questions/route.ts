import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';
import { StudentQuestionCreateSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();

    if (Array.isArray(body)) {
      const results: any[] = [];
      for (const item of body) {
        const validation = validateSchema(StudentQuestionCreateSchema, item);
        if (!validation.valid) return validation.error;
        const create = db.studentAssessmentQuestion.create as any;
        results.push(await create({ data: validation.data }));
      }
      return successResponse(results, `${results.length} questions created`, 201);
    }

    const validation = validateSchema(StudentQuestionCreateSchema, body);
    if (!validation.valid) return validation.error;

    const create = db.studentAssessmentQuestion.create as any;
    const question = await create({ data: validation.data });
    await db.studentAssessmentSection.update({
      where: { id: validation.data.sectionId },
      data: { totalQuestions: { increment: 1 } },
    });

    return successResponse(question, 'Question created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
