import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  const authResult = await requireAuthAndRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;
  const { quizId } = await params;

  try {
    const quiz = await db.lessonQuiz.findUnique({
      where: { id: quizId },
      include: {
        lesson: { select: { id: true, title: true, subjectId: true, classId: true, schoolId: true } },
        questions: { orderBy: { order: 'asc' } },
        attempts: true,
      },
    });

    if (!quiz) return errorResponse('Quiz not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && quiz.lesson.schoolId !== auth.schoolId) return errorResponse('Access denied', 403);

    // Fetch student info for all attempt studentIds
    const studentIds = [...new Set(quiz.attempts.map(a => a.studentId))];
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, admissionNo: true, user: { select: { name: true } } },
    });
    const studentMap = new Map(students.map(s => [s.id, s]));

    const totalAttempts = quiz.attempts.length;
    const completedAttempts = quiz.attempts.filter(a => a.status === 'completed');
    const scores = completedAttempts.map(a => a.score ?? 0);
    const percentages = completedAttempts.map(a => a.percentage ?? 0);

    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const averagePct = percentages.length > 0 ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;
    const passCount = completedAttempts.filter(a => a.passed).length;
    const passRate = completedAttempts.length > 0 ? (passCount / completedAttempts.length) * 100 : 0;

    // Build subject map
    const referencedSubjectIds = [...new Set(quiz.questions.map(q => q.subjectId).filter(Boolean))] as string[];
    const referencedSubjects = referencedSubjectIds.length > 0
      ? await db.subject.findMany({ where: { id: { in: referencedSubjectIds } }, select: { id: true, name: true } })
      : [];
    const subjectMap = new Map<string, string>();
    if (quiz.lesson.subjectId) {
      const lessonSubject = await db.subject.findUnique({ where: { id: quiz.lesson.subjectId }, select: { name: true } });
      if (lessonSubject) subjectMap.set(quiz.lesson.subjectId, lessonSubject.name);
    }
    for (const s of referencedSubjects) subjectMap.set(s.id, s.name);

    // Subject breakdown
    const subjectBreakdownMap: Record<string, {
      subjectName: string; totalQuestions: number; totalMarks: number; correctCount: number;
      topicBreakdown: Record<string, { totalQuestions: number; correctCount: number }>;
    }> = {};
    for (const q of quiz.questions) {
      const sid = q.subjectId || quiz.lesson.subjectId || '__none__';
      if (!subjectBreakdownMap[sid]) {
        subjectBreakdownMap[sid] = {
          subjectName: subjectMap.get(sid) || (sid === '__none__' ? 'Uncategorized' : 'Unknown'),
          totalQuestions: 0, totalMarks: 0, correctCount: 0, topicBreakdown: {},
        };
      }
      subjectBreakdownMap[sid].totalQuestions++;
      subjectBreakdownMap[sid].totalMarks += q.marks || 0;
      const topic = q.topic?.trim();
      if (topic) {
        if (!subjectBreakdownMap[sid].topicBreakdown[topic]) {
          subjectBreakdownMap[sid].topicBreakdown[topic] = { totalQuestions: 0, correctCount: 0 };
        }
        subjectBreakdownMap[sid].topicBreakdown[topic].totalQuestions++;
      }
    }
    for (const a of completedAttempts) {
      try {
        const ansMap = JSON.parse(a.answers || '{}');
        for (const q of quiz.questions) {
          const sid = q.subjectId || quiz.lesson.subjectId || '__none__';
          const ans = ansMap[q.id];
          const isCorrect = ans !== undefined && ans !== null && String(ans).trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
          if (isCorrect) {
            subjectBreakdownMap[sid].correctCount++;
            const topic = q.topic?.trim();
            if (topic && subjectBreakdownMap[sid].topicBreakdown[topic]) {
              subjectBreakdownMap[sid].topicBreakdown[topic].correctCount++;
            }
          }
        }
      } catch {}
    }
    const subjectBreakdown = Object.entries(subjectBreakdownMap).map(([subjectId, sb]) => ({
      subjectId,
      subjectName: sb.subjectName,
      totalQuestions: sb.totalQuestions,
      totalMarks: sb.totalMarks,
      correctCount: sb.correctCount,
      earnedMarks: sb.correctCount, // each correct = answering correctly
      percentage: (sb.totalMarks * completedAttempts.length) > 0
        ? Math.round((sb.correctCount / (sb.totalQuestions * completedAttempts.length)) * 100 * 100) / 100
        : 0,
      topicBreakdown: Object.entries(sb.topicBreakdown).map(([topic, tb]) => ({
        topic,
        totalQuestions: tb.totalQuestions,
        correctCount: tb.correctCount,
        percentage: (tb.totalQuestions * completedAttempts.length) > 0
          ? Math.round((tb.correctCount / (tb.totalQuestions * completedAttempts.length)) * 100 * 100) / 100
          : 0,
      })),
    })).sort((a, b) => b.totalMarks - a.totalMarks);

    const perQuestion: any[] = quiz.questions.map(q => {
      const answers = completedAttempts.map(a => {
        try {
          const ansMap = JSON.parse(a.answers || '{}');
          const ans = ansMap[q.id];
          const isCorrect = ans !== undefined && ans !== null && String(ans).trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
          return { answer: String(ans ?? ''), isCorrect };
        } catch { return { answer: '', isCorrect: false }; }
      });
      const correctCount = answers.filter(a => a.isCorrect).length;
      return {
        questionId: q.id, questionText: q.questionText, type: q.type, marks: q.marks, order: q.order,
        correctAnswer: q.correctAnswer, totalAnswers: answers.length,
        correctCount, correctRate: answers.length > 0 ? Math.round((correctCount / answers.length) * 10000) / 100 : 0,
      };
    });

    const perStudent = completedAttempts.map(a => {
      const stu = studentMap.get(a.studentId);
      return {
        studentId: a.studentId,
        studentName: stu?.user?.name || 'Unknown',
        admissionNo: stu?.admissionNo || '',
        score: a.score, percentage: a.percentage, passed: a.passed, totalMarks: a.totalMarks,
        createdAt: a.createdAt,
      };
    });

    const gradeDist: Record<string, number> = {};
    completedAttempts.forEach(a => {
      const pct = a.percentage ?? 0;
      const grade = pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : pct >= 45 ? 'D' : 'F';
      gradeDist[grade] = (gradeDist[grade] || 0) + 1;
    });

    return successResponse({
      quiz: { id: quiz.id, title: quiz.title, lessonTitle: quiz.lesson.title, timeLimit: quiz.timeLimit, passingScore: quiz.passingScore },
      overview: { totalAttempts, completedCount: completedAttempts.length, averageScore: Math.round(averageScore * 100) / 100, averagePct: Math.round(averagePct * 100) / 100, passRate: Math.round(passRate * 100) / 100, passCount, totalStudents: totalAttempts },
      gradeDistribution: gradeDist,
      perQuestionAnalytics: perQuestion,
      perStudentPerformance: perStudent,
      subjectBreakdown,
    });
  } catch (error: unknown) {
    console.error('[GET /api/lessons/quizzes/[quizId]/analytics]', error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
