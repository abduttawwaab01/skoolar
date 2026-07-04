import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuthAndRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;
  const { id } = await params;

  try {
    const homework = await db.homework.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, dueDate: true, totalMarks: true,
        status: true, subjectId: true, classId: true, schoolId: true, createdAt: true,
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true, section: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
        questions: { orderBy: { order: 'asc' }, select: { id: true, type: true, questionText: true, marks: true, order: true, correctAnswer: true, subjectId: true, topic: true } },
        submissions: {
          select: {
            id: true, studentId: true, score: true, grade: true, status: true, submittedAt: true, gradedAt: true,
            student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } },
            answers: { select: { id: true, questionId: true, answer: true, autoScore: true, manualScore: true } },
          },
        },
        _count: { select: { submissions: true } },
      },
    });

    if (!homework) return errorResponse('Homework not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && homework.schoolId !== auth.schoolId) return errorResponse('Access denied', 403);

    const submissions = homework.submissions;
    const totalStudents = submissions.length;
    const gradedSubmissions = submissions.filter(s => s.status === 'graded');
    const submittedSubmissions = submissions.filter(s => s.status === 'submitted');

    // Overall stats
    const scores = gradedSubmissions.map(s => s.score ?? 0);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passMark = homework.totalMarks * 0.5;
    const passedCount = scores.filter(s => s >= passMark).length;
    const passRate = scores.length > 0 ? (passedCount / scores.length) * 100 : 0;

    // Grade distribution
    const gradeDist: Record<string, number> = {};
    gradedSubmissions.forEach(s => {
      const g = s.grade || 'N/A';
      gradeDist[g] = (gradeDist[g] || 0) + 1;
    });

    // Score distribution (buckets of 10%)
    const scoreBuckets: Record<string, number> = {};
    for (let i = 0; i <= 100; i += 10) {
      scoreBuckets[`${i}-${i + 9}`] = 0;
    }
    scores.forEach(s => {
      const pct = homework.totalMarks > 0 ? (s / homework.totalMarks) * 100 : 0;
      const bucket = Math.floor(pct / 10) * 10;
      const key = `${bucket}-${bucket + 9}`;
      if (scoreBuckets[key] !== undefined) scoreBuckets[key]++;
    });

    // Per-question analytics
    const perQuestionAnalytics = homework.questions.map(q => {
      const answers = submissions.flatMap(s =>
        s.answers.filter(a => a.questionId === q.id).map(a => ({
          answer: a.answer,
          autoScore: a.autoScore,
          studentName: s.student.user.name,
        }))
      );
      const correctCount = answers.filter(a => a.autoScore !== null && a.autoScore > 0).length;
      const totalAnswers = answers.length;
      const correctRate = totalAnswers > 0 ? (correctCount / totalAnswers) * 100 : 0;

      // Answer distribution (for MCQ/MULTI_SELECT/TRUE_FALSE)
      const answerDistribution: Record<string, number> = {};
      answers.forEach(a => {
        const ans = a.answer || '(blank)';
        answerDistribution[ans] = (answerDistribution[ans] || 0) + 1;
      });

      return {
        questionId: q.id,
        questionText: q.questionText,
        type: q.type,
        marks: q.marks,
        order: q.order,
        correctAnswer: q.correctAnswer,
        totalAnswers,
        correctCount,
        correctRate: Math.round(correctRate * 100) / 100,
        wrongCount: totalAnswers - correctCount,
        answerDistribution,
      };
    });

    // Build subject/topic breakdown
    const referencedSubjectIds = [...new Set(homework.questions.map(q => q.subjectId).filter(Boolean))] as string[];
    const referencedSubjects = referencedSubjectIds.length > 0
      ? await db.subject.findMany({ where: { id: { in: referencedSubjectIds } }, select: { id: true, name: true } })
      : [];
    const subjectMap = new Map<string, string>();
    if (homework.subject) subjectMap.set(homework.subject.id, homework.subject.name);
    for (const s of referencedSubjects) subjectMap.set(s.id, s.name);

    const subjectBreakdownMap: Record<string, {
      subjectName: string; totalQuestions: number; totalMarks: number;
      correctCount: number; earnedMarks: number;
      topicBreakdown: Record<string, { totalQuestions: number; totalMarks: number; correctCount: number }>;
    }> = {};
    for (const q of homework.questions) {
      const sid = q.subjectId || '__none__';
      if (!subjectBreakdownMap[sid]) {
        subjectBreakdownMap[sid] = {
          subjectName: subjectMap.get(sid) || (sid === '__none__' ? 'Uncategorized' : 'Unknown'),
          totalQuestions: 0, totalMarks: 0, correctCount: 0, earnedMarks: 0,
          topicBreakdown: {},
        };
      }
      subjectBreakdownMap[sid].totalQuestions++;
      subjectBreakdownMap[sid].totalMarks += q.marks;
      const topic = q.topic?.trim();
      if (topic) {
        if (!subjectBreakdownMap[sid].topicBreakdown[topic]) {
          subjectBreakdownMap[sid].topicBreakdown[topic] = { totalQuestions: 0, totalMarks: 0, correctCount: 0 };
        }
        subjectBreakdownMap[sid].topicBreakdown[topic].totalQuestions++;
        subjectBreakdownMap[sid].topicBreakdown[topic].totalMarks += q.marks;
      }
    }
    for (const s of submissions) {
      for (const q of homework.questions) {
        const sid = q.subjectId || '__none__';
        const ans = s.answers.find(a => a.questionId === q.id);
        const isCorrect = ans?.autoScore !== null && ans?.autoScore !== undefined && ans.autoScore > 0;
        if (isCorrect) {
          subjectBreakdownMap[sid].correctCount++;
          subjectBreakdownMap[sid].earnedMarks += q.marks;
          const topic = q.topic?.trim();
          if (topic && subjectBreakdownMap[sid].topicBreakdown[topic]) {
            subjectBreakdownMap[sid].topicBreakdown[topic].correctCount++;
          }
        }
      }
    }
    const totalStudentsHW = submissions.length;
    const subjectBreakdown = Object.entries(subjectBreakdownMap).map(([subjectId, sb]) => ({
      subjectId,
      subjectName: sb.subjectName,
      totalQuestions: sb.totalQuestions,
      totalMarks: sb.totalMarks,
      correctCount: sb.correctCount,
      earnedMarks: sb.earnedMarks,
      percentage: (sb.totalMarks * totalStudentsHW) > 0
        ? Math.round((sb.earnedMarks / (sb.totalMarks * totalStudentsHW)) * 100 * 100) / 100
        : 0,
      topicBreakdown: Object.entries(sb.topicBreakdown).map(([topic, tb]) => ({
        topic,
        totalQuestions: tb.totalQuestions,
        totalMarks: tb.totalMarks,
        correctCount: tb.correctCount,
        percentage: (tb.totalQuestions * totalStudentsHW) > 0
          ? Math.round((tb.correctCount / (tb.totalQuestions * totalStudentsHW)) * 100 * 100) / 100
          : 0,
      })),
    })).sort((a, b) => b.totalMarks - a.totalMarks);

    // Per-student performance
    const perStudentPerformance = submissions.map(s => {
      const studentAnswers = homework.questions.map(q => {
        const ans = s.answers.find(a => a.questionId === q.id);
        const isCorrect = ans?.autoScore !== null && ans?.autoScore !== undefined && ans.autoScore > 0;
        return {
          questionId: q.id,
          questionText: q.questionText,
          type: q.type,
          marks: q.marks,
          studentAnswer: ans?.answer || null,
          autoScore: ans?.autoScore ?? null,
          manualScore: ans?.manualScore ?? null,
          isCorrect,
        };
      });

      return {
        studentId: s.student.id,
        studentName: s.student.user.name,
        admissionNo: s.student.admissionNo,
        score: s.score,
        grade: s.grade,
        status: s.status,
        submittedAt: s.submittedAt,
        gradedAt: s.gradedAt,
        answers: studentAnswers,
        totalEarned: studentAnswers.reduce((sum, a) => sum + (a.autoScore ?? 0) + (a.manualScore ?? 0), 0),
        totalPossible: studentAnswers.reduce((sum, a) => sum + a.marks, 0),
      };
    });

    // Submission timeline
    const submissionTimeline: Record<string, number> = {};
    submissions.forEach(s => {
      const day = new Date(s.submittedAt).toISOString().split('T')[0];
      submissionTimeline[day] = (submissionTimeline[day] || 0) + 1;
    });

    return successResponse({
      homework: {
        id: homework.id,
        title: homework.title,
        description: homework.description,
        dueDate: homework.dueDate,
        totalMarks: homework.totalMarks,
        status: homework.status,
        subject: homework.subject,
        class: homework.class,
        teacher: homework.teacher,
        questionsCount: homework.questions.length,
        totalSubmissions: homework._count.submissions,
      },
      overview: {
        totalStudents,
        gradedCount: gradedSubmissions.length,
        submittedCount: submittedSubmissions.length,
        averageScore: Math.round(averageScore * 100) / 100,
        highestScore,
        lowestScore,
        passRate: Math.round(passRate * 100) / 100,
        passedCount,
        totalPossible: homework.totalMarks,
      },
      gradeDistribution: gradeDist,
      scoreDistribution: scoreBuckets,
      perQuestionAnalytics,
      perStudentPerformance,
      submissionTimeline,
      subjectBreakdown,
    });
  } catch (error: unknown) {
    console.error('[GET /api/homework/[id]/analytics]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
