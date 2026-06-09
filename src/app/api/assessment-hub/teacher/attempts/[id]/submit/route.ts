import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';
import { TeacherAttemptSubmitSchema } from '@/lib/validators/assessment';
import { computeDomainResults, computeOverallMasteryScore, determineTrend } from '@/lib/assessment-engine';

export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const validation = validateSchema(TeacherAttemptSubmitSchema, { ...body, attemptId: id });
    if (!validation.valid) return validation.error;

    const attempt = await db.teacherAssessmentAttempt.findFirst({
      where: { id, schoolId: ctx.schoolId },
      include: {
        assessment: { include: { sections: { orderBy: { order: 'asc' }, include: { questions: true } } } },
      },
    });
    if (!attempt) return errorResponse('Attempt not found', 404);
    if (attempt.status !== 'in_progress') return errorResponse('Already submitted', 400);

    const questions = attempt.assessment.sections.flatMap(s => s.questions);
    const totalScore = questions.reduce((sum, q) => {
      const answer = validation.data.answers[q.id];
      return sum + (answer ? q.marks : 0);
    }, 0);
    const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);

    const domainScores: Record<string, { score: number; max: number }> = {};
    for (const section of attempt.assessment.sections) {
      const sectionQuestions = questions.filter(q => q.sectionId === section.id);
      const sectionScore = sectionQuestions.reduce((sum, q) => sum + (validation.data.answers[q.id] ? q.marks : 0), 0);
      const sectionMax = sectionQuestions.reduce((sum, q) => sum + q.marks, 0);
      domainScores[section.domain] = { score: sectionScore, max: sectionMax };
    }

    await db.teacherAssessmentAttempt.update({
      where: { id },
      data: {
        status: 'submitted', submittedAt: new Date(),
        answers: JSON.stringify(validation.data.answers),
        domainScores: JSON.stringify(domainScores),
        timeTakenSeconds: validation.data.timeTakenSeconds || 0,
      },
    });

    for (const [domain, scores] of Object.entries(domainScores)) {
      const percentage = scores.max > 0 ? Math.round((scores.score / scores.max) * 100) : 0;
      await db.teacherCompetencyProfile.upsert({
        where: { teacherId_domain_competencyName: { teacherId: attempt.teacherId, domain, competencyName: domain } },
        create: {
          teacherId: attempt.teacherId, schoolId: ctx.schoolId,
          domain, competencyName: domain, score: percentage, lastAssessedAt: new Date(), assessmentCount: 1,
        },
        update: {
          score: percentage, lastAssessedAt: new Date(), assessmentCount: { increment: 1 },
        },
      });
    }

    return successResponse({ attemptId: id, domainScores, overallScore: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0 }, 'Assessment submitted');
  }, req);
