import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/api-helpers';
import { StudentQuestionUpdateSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';

export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const validation = validateSchema(StudentQuestionUpdateSchema, body);
    if (!validation.valid) return validation.error;

    const question = await db.studentAssessmentQuestion.update({ where: { id }, data: validation.data });
    return successResponse(question, 'Question updated');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);

export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const question = await db.studentAssessmentQuestion.findUnique({ where: { id }, select: { sectionId: true } });
    await db.studentAssessmentQuestion.delete({ where: { id } });
    if (question) {
      await db.studentAssessmentSection.update({
        where: { id: question.sectionId },
        data: { totalQuestions: { decrement: 1 } },
      });
    }
    return successResponse(null, 'Question deleted');
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
