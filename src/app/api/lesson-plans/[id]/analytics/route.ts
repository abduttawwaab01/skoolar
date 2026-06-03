import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuthAndRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;
  const { id } = await params;

  try {
    const plan = await db.lessonPlan.findUnique({
      where: { id },
      select: { id: true, topic: true, schoolId: true, subjectId: true, classId: true, quiz: true, masteryThresholds: true, status: true },
    });

    if (!plan) return errorResponse('Lesson plan not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && plan.schoolId !== auth.schoolId) return errorResponse('Access denied', 403);

    const attempts = await db.lessonPlanAttempt.findMany({
      where: { planId: id },
      orderBy: [{ studentId: 'asc' }, { attemptNumber: 'desc' }],
      include: { student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } } },
    });

    // Parse quiz questions
    let quizQuestions: any[] = [];
    try { quizQuestions = JSON.parse(plan.quiz || '[]'); } catch { quizQuestions = []; }

    const totalStudents = new Set(attempts.map(a => a.studentId)).size;
    const completedAttempts = attempts.filter(a => a.completedAt);
    const scores = completedAttempts.map(a => a.score ?? 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const totalPossible = quizQuestions.reduce((s: number, q: any) => s + (q.marks || 1), 0);

    // Mastery distribution
    const masteryDist: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0, mastered: 0 };
    completedAttempts.forEach(a => { if (a.masteryLevel) masteryDist[a.masteryLevel] = (masteryDist[a.masteryLevel] || 0) + 1; });

    // Per-question analysis
    const perQuestion = quizQuestions.map((q: any, idx: number) => {
      const answers = completedAttempts.map(a => {
        try {
          const ansMap = JSON.parse(a.answers || '{}');
          const ans = ansMap[String(idx)];
          const isCorrect = ans !== undefined && ans !== null && String(ans).trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
          return { answer: String(ans ?? ''), isCorrect };
        } catch { return { answer: '', isCorrect: false }; }
      });
      const correctCount = answers.filter(a => a.isCorrect).length;
      return {
        questionIndex: idx, questionText: q.questionText, type: q.type || 'MCQ', marks: q.marks || 1,
        correctAnswer: q.correctAnswer, totalAnswers: answers.length,
        correctCount, correctRate: answers.length > 0 ? Math.round((correctCount / answers.length) * 10000) / 100 : 0,
      };
    });

    // Per-student
    const bestPerStudent: Record<string, any> = {};
    completedAttempts.forEach(a => {
      const existing = bestPerStudent[a.studentId];
      if (!existing || (a.score ?? 0) > (existing.score ?? 0)) {
        bestPerStudent[a.studentId] = {
          studentId: a.studentId, studentName: a.student.user.name, admissionNo: a.student.admissionNo,
          score: a.score, totalMarks: a.totalMarks, masteryLevel: a.masteryLevel, passed: a.passed,
          attemptNumber: a.attemptNumber, completedAt: a.completedAt,
        };
      }
    });

    return successResponse({
      lessonPlan: { id: plan.id, topic: plan.topic, status: plan.status, questionCount: quizQuestions.length, totalPossible },
      overview: { totalStudents, totalAttempts: attempts.length, completedAttempts: completedAttempts.length, averageScore: Math.round(avgScore * 100) / 100, totalPossible },
      masteryDistribution: masteryDist,
      perQuestionAnalytics: perQuestion,
      perStudentPerformance: Object.values(bestPerStudent).sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0)),
    });
  } catch (error: unknown) {
    console.error('[GET /api/lesson-plans/[id]/analytics]', error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
