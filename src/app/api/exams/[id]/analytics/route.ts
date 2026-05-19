import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function formatAnswer(type: string, answer: unknown): string {
  if (answer === null || answer === undefined || answer === '') return 'Not answered';
  if (type === 'MULTI_SELECT' && Array.isArray(answer)) return answer.join(', ');
  if (type === 'TRUE_FALSE') return answer === true || answer === 'true' ? 'True' : 'False';
  if (type === 'MATCHING' && typeof answer === 'object') {
    const pairs = answer as Record<string, string>;
    return Object.entries(pairs).map(([k, v]) => `${k}→${v}`).join('; ');
  }
  return String(answer);
}

function isAnswerCorrect(question: {
  id: string; type: string; correctAnswer: string | null; marks: number;
}, answer: unknown, negativeMarking: number): boolean {
  if (!question.correctAnswer) return false;
  if (answer === undefined || answer === null || answer === '') return false;
  let correctAnswer: unknown;
  try { correctAnswer = JSON.parse(question.correctAnswer); } catch { correctAnswer = question.correctAnswer; }
  switch (question.type) {
    case 'MCQ': return String(answer).trim() === String(correctAnswer).trim();
    case 'MULTI_SELECT': {
      const sArr = Array.isArray(answer) ? answer.map(String).sort() : [];
      const cArr = Array.isArray(correctAnswer) ? (correctAnswer as unknown[]).map(String).sort() : [];
      return JSON.stringify(sArr) === JSON.stringify(cArr);
    }
    case 'TRUE_FALSE': return String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
    case 'FILL_BLANK': {
      const acceptable = Array.isArray(correctAnswer)
        ? (correctAnswer as unknown[]).map(a => String(a).trim().toLowerCase())
        : [String(correctAnswer).trim().toLowerCase()];
      return acceptable.includes(String(answer).trim().toLowerCase());
    }
    default: return false;
  }
}

function computeMarks(question: { id: string; type: string; correctAnswer: string | null; marks: number }, answer: unknown, negativeMarking: number): number {
  if (!isAnswerCorrect(question, answer, negativeMarking)) {
    if (answer === null || answer === undefined || answer === '') return 0;
    return negativeMarking > 0 ? -(question.marks * negativeMarking) : 0;
  }
  return question.marks;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        subject: { select: { id: true, name: true } },
        scores: { include: { student: { include: { user: { select: { name: true } } } } } },
      },
    });

    if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    if (auth.role !== 'SUPER_ADMIN') {
      if (auth.schoolId && exam.schoolId !== auth.schoolId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role || '')) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const attempts = await db.examAttempt.findMany({
      where: { examId: id, status: { in: ['submitted', 'graded'] } },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
    });

    const negativeMarking = exam.negativeMarking || 0;
    const totalStudents = attempts.length;
    const totalMarks = exam.questions.reduce((sum, q) => sum + q.marks, 0);

    // ── Compute per-student scores for ranking ──
    const studentScores = attempts.map(attempt => {
      const answers = safeJsonParse(attempt.answers) as Record<string, unknown> | null;
      let autoScore = 0;
      const perQuestion: { questionId: string; index: number; isCorrect: boolean; marksAwarded: number }[] = [];
      for (const q of exam.questions) {
        const studentAnswer = answers?.[q.id] ?? null;
        const isCorrect = isAnswerCorrect(q, studentAnswer, negativeMarking);
        const marksAwarded = computeMarks(q, studentAnswer, negativeMarking);
        autoScore += marksAwarded;
        perQuestion.push({ questionId: q.id, index: q.order, isCorrect, marksAwarded });
      }
      const percentage = totalMarks > 0 ? Math.round((autoScore / totalMarks) * 100 * 100) / 100 : 0;
      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';
      return {
        studentId: attempt.studentId,
        studentName: attempt.student.user.name,
        admissionNo: attempt.student.admissionNo,
        status: attempt.status,
        autoScore,
        percentage,
        grade,
        correctedCount: perQuestion.filter(q => q.isCorrect).length,
        totalQuestions: exam.questions.length,
        timeTakenSeconds: attempt.timeTakenSeconds,
        submittedAt: attempt.submittedAt,
        perQuestion,
        answers,
      };
    }).sort((a, b) => b.percentage - a.percentage)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // ── Per-question analytics with advanced metrics ──
    const questionAnalytics = exam.questions.map((q) => {
      const correctCount: number[] = [];
      const wrongCount: number[] = [];
      const unansweredCount: number[] = [];
      const studentAnswersList: { studentId: string; studentName: string; answer: unknown; answerFormatted: string; isCorrect: boolean }[] = [];
      const studentMarksList: { studentId: string; marks: number; totalScore: number }[] = [];
      let cCount = 0, wCount = 0, uCount = 0;

      for (const ss of studentScores) {
        const sa = ss.answers?.[q.id] ?? null;
        const isCorrect = isAnswerCorrect(q, sa, negativeMarking);
        const answered = sa !== null && sa !== '' && sa !== undefined;
        if (!answered) uCount++;
        else if (isCorrect) cCount++;
        else wCount++;
        studentAnswersList.push({
          studentId: ss.studentId,
          studentName: ss.studentName,
          answer: sa,
          answerFormatted: answered ? formatAnswer(q.type, sa) : 'Not answered',
          isCorrect,
        });
        studentMarksList.push({
          studentId: ss.studentId,
          marks: isCorrect ? 1 : 0,
          totalScore: ss.percentage,
        });
      }

      const totalAnswered = cCount + wCount;
      const difficultyIndex = totalStudents > 0 ? cCount / totalStudents : 0;

      // ── Discrimination index (upper/lower 27% method) ──
      const sorted = [...studentMarksList].sort((a, b) => b.totalScore - a.totalScore);
      const groupSize = Math.max(1, Math.round(totalStudents * 0.27));
      const upperGroup = sorted.slice(0, groupSize);
      const lowerGroup = sorted.slice(-groupSize);
      const upperCorrect = upperGroup.filter(u => u.marks === 1).length;
      const lowerCorrect = lowerGroup.filter(l => l.marks === 1).length;
      const discriminationIndex = groupSize > 0 ? (upperCorrect - lowerCorrect) / groupSize : 0;

      // ── Point-biserial correlation (alternative discrimination) ──
      const correctScores = studentMarksList.filter(m => m.marks === 1).map(m => m.totalScore);
      const incorrectScores = studentMarksList.filter(m => m.marks === 0).map(m => m.totalScore);
      const meanCorrect = correctScores.length > 0 ? correctScores.reduce((a, b) => a + b, 0) / correctScores.length : 0;
      const meanIncorrect = incorrectScores.length > 0 ? incorrectScores.reduce((a, b) => a + b, 0) / incorrectScores.length : 0;
      const allScores = studentMarksList.map(m => m.totalScore);
      const meanAll = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
      const stdAll = allScores.length > 1 ? Math.sqrt(allScores.reduce((sum, s) => sum + (s - meanAll) ** 2, 0) / allScores.length) : 1;
      const p = cCount / totalStudents;
      const qVal = 1 - p;
      const pointBiserial = (stdAll > 0 && p > 0 && qVal > 0)
        ? ((meanCorrect - meanIncorrect) / stdAll) * Math.sqrt(p * qVal)
        : 0;

      // ── Wrong answer distribution with misconception flagging ──
      const wrongDistribution: Record<string, number> = {};
      for (const sa of studentAnswersList) {
        if (!sa.isCorrect && sa.answerFormatted !== 'Not answered') {
          wrongDistribution[sa.answerFormatted] = (wrongDistribution[sa.answerFormatted] || 0) + 1;
        }
      }
      const sortedWrong = Object.entries(wrongDistribution).sort(([, a], [, b]) => b - a);
      const commonMisconception = sortedWrong.length > 0 && sortedWrong[0][1] > 1
        ? { answer: sortedWrong[0][0], count: sortedWrong[0][1], percentage: Math.round((sortedWrong[0][1] / totalStudents) * 100 * 10) / 10 }
        : null;

      // ── Difficulty label ──
      let difficultyLabel = 'Very Hard';
      if (difficultyIndex >= 0.9) difficultyLabel = 'Very Easy';
      else if (difficultyIndex >= 0.7) difficultyLabel = 'Easy';
      else if (difficultyIndex >= 0.5) difficultyLabel = 'Medium';
      else if (difficultyIndex >= 0.3) difficultyLabel = 'Hard';

      let discriminationLabel = 'Poor';
      if (discriminationIndex >= 0.4) discriminationLabel = 'Excellent';
      else if (discriminationIndex >= 0.3) discriminationLabel = 'Good';
      else if (discriminationIndex >= 0.2) discriminationLabel = 'Fair';

      let correctAnswerParsed: unknown = null;
      try { correctAnswerParsed = JSON.parse(q.correctAnswer || 'null'); } catch { correctAnswerParsed = q.correctAnswer; }

      return {
        questionId: q.id,
        index: q.order,
        type: q.type,
        questionText: q.questionText,
        marks: q.marks,
        correctAnswer: correctAnswerParsed,
        correctAnswerFormatted: formatAnswer(q.type, correctAnswerParsed),
        explanation: q.explanation,
        difficulty: {
          index: Math.round(difficultyIndex * 1000) / 1000,
          label: difficultyLabel,
          correctCount: cCount,
          wrongCount: wCount,
          unansweredCount: uCount,
          totalStudents,
          correctPercentage: totalStudents > 0 ? Math.round((cCount / totalStudents) * 100 * 10) / 10 : 0,
          wrongPercentage: totalStudents > 0 ? Math.round((wCount / totalStudents) * 100 * 10) / 10 : 0,
          unansweredPercentage: totalStudents > 0 ? Math.round((uCount / totalStudents) * 100 * 10) / 10 : 0,
        },
        discrimination: {
          index: Math.round(discriminationIndex * 1000) / 1000,
          label: discriminationLabel,
          pointBiserial: Math.round(pointBiserial * 1000) / 1000,
          upperCorrectCount: upperCorrect,
          lowerCorrectCount: lowerCorrect,
          groupSize,
        },
        commonMisconception,
        wrongDistribution: sortedWrong.slice(0, 10).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {} as Record<string, number>),
        studentAnswers: studentAnswersList,
      };
    });

    // ── Question type breakdown ──
    const typeBreakdown: Record<string, { count: number; totalMarks: number; avgDifficulty: number; avgDiscrimination: number; totalCorrect: number; totalStudents: number }> = {};
    for (const qa of questionAnalytics) {
      if (!typeBreakdown[qa.type]) typeBreakdown[qa.type] = { count: 0, totalMarks: 0, avgDifficulty: 0, avgDiscrimination: 0, totalCorrect: 0, totalStudents: 0 };
      typeBreakdown[qa.type].count++;
      typeBreakdown[qa.type].totalMarks += qa.marks;
      typeBreakdown[qa.type].avgDifficulty += qa.difficulty.index;
      typeBreakdown[qa.type].avgDiscrimination += qa.discrimination.index;
      typeBreakdown[qa.type].totalCorrect += qa.difficulty.correctCount;
      typeBreakdown[qa.type].totalStudents = totalStudents;
    }
    const questionTypeBreakdown = Object.entries(typeBreakdown).map(([type, data]) => ({
      type,
      questionCount: data.count,
      totalMarks: data.totalMarks,
      avgDifficulty: data.count > 0 ? Math.round((data.avgDifficulty / data.count) * 1000) / 1000 : 0,
      avgDiscrimination: data.count > 0 ? Math.round((data.avgDiscrimination / data.count) * 1000) / 1000 : 0,
      correctPercentage: (data.totalStudents * data.count) > 0 ? Math.round((data.totalCorrect / (data.totalStudents * data.count)) * 100 * 10) / 10 : 0,
    }));

    // ── Class-level stats ──
    const scores = studentScores.map(s => s.percentage);
    const classAverage = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passMarkPercent = (exam.passingMarks / exam.totalMarks) * 100;
    const passedCount = scores.filter(s => s >= passMarkPercent).length;
    const passRate = scores.length > 0 ? Math.round((passedCount / scores.length) * 100 * 10) / 10 : 0;

    // Median
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores.length > 0
      ? sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
        : sortedScores[Math.floor(sortedScores.length / 2)]
      : 0;

    // Standard deviation
    const variance = scores.length > 1 ? scores.reduce((sum, s) => sum + (s - classAverage) ** 2, 0) / scores.length : 0;
    const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

    // Grade distribution
    const gradeDistribution: Record<string, number> = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    for (const s of studentScores) gradeDistribution[s.grade] = (gradeDistribution[s.grade] || 0) + 1;

    // Time stats
    const timeValues = studentScores.map(s => s.timeTakenSeconds).filter((t): t is number => t !== null);
    const avgTimeSeconds = timeValues.length > 0 ? Math.round(timeValues.reduce((a, b) => a + b, 0) / timeValues.length) : 0;
    const maxTime = timeValues.length > 0 ? Math.max(...timeValues) : 0;
    const minTime = timeValues.length > 0 ? Math.min(...timeValues) : 0;

    // ── Time vs performance correlation ──
    const validTimeScores = studentScores.filter(s => s.timeTakenSeconds !== null) as { percentage: number; timeTakenSeconds: number }[];
    let timeCorrelation = 0;
    if (validTimeScores.length > 2) {
      const n = validTimeScores.length;
      const sumX = validTimeScores.reduce((a, b) => a + b.timeTakenSeconds, 0);
      const sumY = validTimeScores.reduce((a, b) => a + b.percentage, 0);
      const sumXY = validTimeScores.reduce((a, b) => a + b.timeTakenSeconds * b.percentage, 0);
      const sumX2 = validTimeScores.reduce((a, b) => a + b.timeTakenSeconds ** 2, 0);
      const sumY2 = validTimeScores.reduce((a, b) => a + b.percentage ** 2, 0);
      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
      timeCorrelation = den !== 0 ? Math.round((num / den) * 1000) / 1000 : 0;
    }

    // ── Student comparison data (per-question class averages) ──
    const questionAverages = questionAnalytics.map(qa => ({
      questionId: qa.questionId,
      classCorrectPercentage: qa.difficulty.correctPercentage,
    }));

    // ── Historical comparison (fetch same-subject exams in same term/class) ──
    let previousExams: { examId: string; examName: string; classAverage: number; passRate: number }[] = [];
    try {
      const prevExams = await db.exam.findMany({
        where: {
          schoolId: exam.schoolId,
          subjectId: exam.subjectId,
          id: { not: id },
          termId: exam.termId,
          isPublished: true,
        },
        select: { id: true, name: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      previousExams = await Promise.all(prevExams.map(async (pe) => {
        const peScores = await db.examScore.findMany({ where: { examId: pe.id }, select: { score: true } });
        const peTotalMarks = (await db.exam.findUnique({ where: { id: pe.id }, select: { totalMarks: true } }))?.totalMarks || 1;
        const pcts = peScores.map(s => (s.score / peTotalMarks) * 100);
        const avg = pcts.length > 0 ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) / 100 : 0;
        const passM = (exam.passingMarks / exam.totalMarks) * 100;
        const passd = pcts.filter(p => p >= passM).length;
        return { examId: pe.id, examName: pe.name, classAverage: avg, passRate: pcts.length > 0 ? Math.round((passd / pcts.length) * 100 * 10) / 10 : 0 };
      }));
    } catch { /* historical data optional */ }

    return NextResponse.json({
      data: {
        exam: {
          id: exam.id, name: exam.name, type: exam.type,
          subject: exam.subject, totalMarks, passingMarks: exam.passingMarks, negativeMarking,
          createdAt: exam.createdAt,
        },
        totalStudents,
        classStats: {
          classAverage, medianScore, stdDev,
          highestScore, lowestScore,
          passRate, passedCount, failedCount: scores.length - passedCount,
          averageTimeSeconds: avgTimeSeconds, maxTimeSeconds: maxTime, minTimeSeconds: minTime,
          timeScoreCorrelation: timeCorrelation,
        },
        gradeDistribution,
        questionAnalytics,
        questionTypeBreakdown,
        studentPerformance: studentScores,
        questionAverages,
        historicalComparison: previousExams,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
