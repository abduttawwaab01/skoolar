import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';
import { StudentQuestionCreateSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';
import { distributeMarks } from '@/lib/marks-utils';

async function recalcStudentMarks(assessmentId: string) {
  const assessment = await db.studentAssessment.findUnique({ where: { id: assessmentId }, select: { totalMarks: true } });
  if (!assessment) return;
  const allQuestions = await db.studentAssessmentQuestion.findMany({ where: { assessmentId }, orderBy: { order: 'asc' } });
  if (allQuestions.length === 0) return;
  const marks = distributeMarks(assessment.totalMarks, allQuestions.length);
  await Promise.all(allQuestions.map((q, i) =>
    db.studentAssessmentQuestion.update({ where: { id: q.id }, data: { marks: marks[i] } })
  ));
}

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
      if (results.length > 0) {
        await recalcStudentMarks(results[0].assessmentId);
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

    await recalcStudentMarks(validation.data.assessmentId);

    return successResponse(question, 'Question created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
