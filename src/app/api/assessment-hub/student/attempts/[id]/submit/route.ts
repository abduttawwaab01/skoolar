import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/api-helpers';
import { StudentAttemptSubmitSchema } from '@/lib/validators/assessment';
import { validateSchema } from '@/lib/api-helpers';
import {
  computeDomainResults,
  computeOverallMasteryScore,
  determineMasteryLevel,
  determineTrend,
  computeLearningStyle,
  generateRecommendations,
  calculateGrowthScore,
  gradeObjectiveAnswer,
} from '@/lib/assessment-engine';

export const POST = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const body = await req.json();
    const validation = validateSchema(StudentAttemptSubmitSchema, { ...body, attemptId: id });
    if (!validation.valid) return validation.error;

    const attempt = await db.studentAssessmentAttempt.findFirst({
      where: { id, schoolId: ctx.schoolId },
      include: {
        assessment: {
          include: {
            sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    });
    if (!attempt) return errorResponse('Attempt not found', 404);
    if (attempt.status !== 'in_progress') return errorResponse('Attempt already submitted', 400);

    const questions = attempt.assessment.sections.flatMap(s => s.questions);
    const answers = Object.entries(validation.data.answers).map(([questionId, answer]) => {
      const question = questions.find(q => q.id === questionId);
      if (!question) return { questionId, answer, marksAwarded: 0, isCorrect: false };
      const grading = question.correctAnswer
        ? gradeObjectiveAnswer(
            { id: question.id, type: question.type, questionText: question.questionText, options: question.options || undefined, correctAnswer: question.correctAnswer, marks: question.marks, difficulty: question.difficulty, skillTag: question.skillTag || undefined, category: question.category || undefined, weight: question.weight },
            answer
          )
        : { isCorrect: undefined, marksAwarded: 0 };
      return { questionId, answer, marksAwarded: grading.marksAwarded, isCorrect: grading.isCorrect };
    });

    const totalAutoScore = answers.reduce((sum, a) => sum + a.marksAwarded, 0);
    const totalMaxScore = questions.reduce((sum, q) => sum + q.marks * q.weight, 0);

    const domainResults = attempt.assessment.sections.map(section => {
      const sectionQIds = new Set(section.questions.map(q => q.id));
      const sectionAnswers = answers.filter(a => sectionQIds.has(a.questionId));
      const sectionQuestions = section.questions.map(q => ({
        id: q.id, type: q.type, questionText: q.questionText, options: q.options || undefined,
        correctAnswer: q.correctAnswer || undefined, marks: q.marks, difficulty: q.difficulty,
        skillTag: q.skillTag || undefined, category: q.category || undefined, weight: q.weight,
      }));
      return computeDomainResults(sectionQuestions, sectionAnswers, section.domain);
    });

    for (const dr of domainResults) {
      await db.studentDomainResult.upsert({
        where: { assessmentId_studentId_domain: { assessmentId: attempt.assessmentId, studentId: attempt.studentId, domain: dr.domain } },
        create: {
          assessmentId: attempt.assessmentId, studentId: attempt.studentId, attemptId: id,
          sectionId: attempt.assessment.sections.find(s => s.domain === dr.domain)?.id,
          domain: dr.domain, score: dr.score, maxScore: dr.maxScore, percentage: dr.percentage,
          masteryLevel: dr.masteryLevel, strengths: JSON.stringify(dr.strengths), weaknesses: JSON.stringify(dr.weaknesses),
          skillBreakdown: JSON.stringify(dr.skillBreakdown),
        },
        update: {
          score: dr.score, maxScore: dr.maxScore, percentage: dr.percentage, masteryLevel: dr.masteryLevel,
          strengths: JSON.stringify(dr.strengths), weaknesses: JSON.stringify(dr.weaknesses),
          skillBreakdown: JSON.stringify(dr.skillBreakdown),
        },
      });

      for (const skill of dr.skillBreakdown) {
        await db.studentSkillProfile.upsert({
          where: { studentId_domain_skillName: { studentId: attempt.studentId, domain: dr.domain, skillName: skill.skillName } },
          create: {
            studentId: attempt.studentId, schoolId: ctx.schoolId, domain: dr.domain, skillName: skill.skillName,
            masteryScore: skill.percentage, lastAssessedAt: new Date(), assessmentCount: 1, trend: 'stable',
          },
          update: {
            masteryScore: skill.percentage, lastAssessedAt: new Date(), assessmentCount: { increment: 1 },
          },
        });
      }
    }

    if (attempt.assessment.type === 'learning_style') {
      const styleQuestions = questions.map(q => ({
        id: q.id, type: q.type, questionText: q.questionText, options: q.options || undefined,
        correctAnswer: q.correctAnswer || undefined, marks: q.marks, difficulty: q.difficulty,
        skillTag: q.skillTag || undefined, category: q.category || undefined, weight: q.weight,
      }));
      const learningStyle = computeLearningStyle(answers, styleQuestions);
      await db.studentLearningStyleProfile.upsert({
        where: { studentId: attempt.studentId },
        create: {
          studentId: attempt.studentId, schoolId: ctx.schoolId,
          visual: learningStyle.visual, auditory: learningStyle.auditory,
          kinesthetic: learningStyle.kinesthetic, readingWriting: learningStyle.readingWriting,
          primaryStyle: learningStyle.primaryStyle, secondaryStyle: learningStyle.secondaryStyle,
          lastAssessedAt: new Date(),
        },
        update: {
          visual: learningStyle.visual, auditory: learningStyle.auditory,
          kinesthetic: learningStyle.kinesthetic, readingWriting: learningStyle.readingWriting,
          primaryStyle: learningStyle.primaryStyle, secondaryStyle: learningStyle.secondaryStyle,
          lastAssessedAt: new Date(),
        },
      });
    }

    const finalScore = validation.data.answers && totalAutoScore > 0
      ? computeOverallMasteryScore(domainResults)
      : null;

    await db.studentAssessmentAttempt.update({
      where: { id },
      data: {
        status: 'submitted', submittedAt: new Date(),
        answers: JSON.stringify(validation.data.answers),
        autoScore: totalAutoScore, finalScore: finalScore || 0,
        timeTakenSeconds: validation.data.timeTakenSeconds || 0,
        tabSwitchCount: validation.data.tabSwitchCount || 0,
        securityViolations: validation.data.securityViolations || null,
      },
    });

    const student = await db.student.findUnique({ where: { id: attempt.studentId }, select: { classId: true } });
    await db.studentGrowthRecord.create({
      data: {
        studentId: attempt.studentId, schoolId: ctx.schoolId,
        overallScore: computeOverallMasteryScore(domainResults),
        domainScores: JSON.stringify(domainResults.map(d => ({ domain: d.domain, percentage: d.percentage }))),
        trend: 'stable',
      },
    });

    const previousGrowth = await db.studentGrowthRecord.findFirst({
      where: { studentId: attempt.studentId },
      orderBy: { snapshotDate: 'desc' },
      skip: 1,
    });

    if (previousGrowth?.overallScore !== null && previousGrowth?.overallScore !== undefined) {
      const trend = determineTrend(computeOverallMasteryScore(domainResults), previousGrowth.overallScore);
      await db.studentGrowthRecord.update({
        where: { id: (await db.studentGrowthRecord.findFirst({ where: { studentId: attempt.studentId }, orderBy: { snapshotDate: 'desc' } }))!.id },
        data: { trend },
      });
    }

    const recommendations = generateRecommendations(
      domainResults,
      undefined
    );
    for (const rec of recommendations) {
      await db.studentRecommendation.create({
        data: {
          studentId: attempt.studentId, schoolId: ctx.schoolId,
          assessmentId: attempt.assessmentId, domain: rec.domain,
          skillName: rec.skillName, recommendationType: rec.recommendationType,
          title: rec.title, description: rec.description, priority: rec.priority,
        },
      });
    }

    return successResponse({
      attemptId: id,
      domainResults,
      overallScore: computeOverallMasteryScore(domainResults),
      recommendations,
    }, 'Assessment submitted and graded successfully');
  }, req);
