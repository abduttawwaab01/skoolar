import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { TeacherQuestionCreateSchema } from '@/lib/validators/assessment';
import { distributeMarks } from '@/lib/marks-utils';

async function recalcTeacherMarks(assessmentId: string) {
  const assessment = await db.teacherAssessment.findUnique({ where: { id: assessmentId }, select: { totalMarks: true } });
  if (!assessment) return;
  const allQuestions = await db.teacherAssessmentQuestion.findMany({ where: { assessmentId }, orderBy: { order: 'asc' } });
  if (allQuestions.length === 0) return;
  const marks = distributeMarks(assessment.totalMarks, allQuestions.length);
  await Promise.all(allQuestions.map((q, i) =>
    db.teacherAssessmentQuestion.update({ where: { id: q.id }, data: { marks: marks[i] } })
  ));
}

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
      if (results.length > 0) {
        await recalcTeacherMarks(results[0].assessmentId);
      }
      return successResponse(results, `${results.length} questions created`, 201);
    }
    const validation = validateSchema(TeacherQuestionCreateSchema, body);
    if (!validation.valid) return validation.error;
    const create = db.teacherAssessmentQuestion.create as any;
    const question = await create({ data: validation.data });
    await recalcTeacherMarks(validation.data.assessmentId);
    return successResponse(question, 'Question created', 201);
  }, req, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
