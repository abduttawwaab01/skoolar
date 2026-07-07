import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatAnswer(type: string, answer: unknown): string {
  if (answer === null || answer === undefined || answer === '') return 'Not answered';
  if (type === 'MULTI_SELECT' && Array.isArray(answer)) return answer.join(', ');
  if (type === 'TRUE_FALSE') return answer === true || answer === 'true' ? 'True' : 'False';
  if (type === 'MATCHING' && typeof answer === 'object') {
    const pairs = answer as Record<string, string>;
    return Object.entries(pairs).map(([k, v]) => `${k} → ${v}`).join('; ');
  }
  return String(answer);
}

function gradeQuestion(question: {
  id: string;
  type: string;
  correctAnswer: string | null;
  marks: number;
}, answer: unknown, negativeMarking: number): { marksAwarded: number; isCorrect: boolean } {
  if (!question.correctAnswer) return { marksAwarded: 0, isCorrect: false };
  if (answer === undefined || answer === null || answer === '') return { marksAwarded: 0, isCorrect: false };

  let correctAnswer: unknown;
  try { correctAnswer = JSON.parse(question.correctAnswer); } catch { correctAnswer = question.correctAnswer; }

  const deduction = negativeMarking > 0 ? -(question.marks * negativeMarking) : 0;

  switch (question.type) {
    case 'MCQ': {
      const match = String(answer).trim() === String(correctAnswer).trim();
      return { marksAwarded: match ? question.marks : deduction, isCorrect: match };
    }
    case 'MULTI_SELECT': {
      const studentArr = Array.isArray(answer) ? answer.map(String).sort() : [];
      const correctArr = Array.isArray(correctAnswer) ? (correctAnswer as unknown[]).map(String).sort() : [];
      const match = JSON.stringify(studentArr) === JSON.stringify(correctArr);
      return { marksAwarded: match ? question.marks : deduction, isCorrect: match };
    }
    case 'TRUE_FALSE': {
      const match = String(answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      return { marksAwarded: match ? question.marks : deduction, isCorrect: match };
    }
    case 'FILL_BLANK': {
      const studentAns = String(answer).trim().toLowerCase();
      const acceptable = Array.isArray(correctAnswer)
        ? (correctAnswer as unknown[]).map(a => String(a).trim().toLowerCase())
        : [String(correctAnswer).trim().toLowerCase()];
      const match = acceptable.includes(studentAns);
      return { marksAwarded: match ? question.marks : deduction, isCorrect: match };
    }
    default:
      return { marksAwarded: 0, isCorrect: false };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const exam = await db.exam.findUnique({
      where: auth.role === 'SUPER_ADMIN' ? { id } : { id, schoolId: auth.schoolId },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const attempt = await db.examAttempt.findUnique({
      where: { examId_studentId: { examId: id, studentId } },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
    });

    if (!attempt) {
      return NextResponse.json({ error: 'No attempt found for this student' }, { status: 404 });
    }

    if (auth.role === 'STUDENT') {
      const authStudent = await db.student.findFirst({
        where: { userId: auth.userId },
        select: { userId: true },
      });
      if (!authStudent || authStudent.userId !== studentId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const studentAnswers = safeJsonParse(attempt.answers) as Record<string, unknown> | null;
    const negativeMarking = exam.negativeMarking || 0;
    const totalMarks = exam.questions.reduce((sum, q) => sum + q.marks, 0);
    let autoScore = 0;

    const questions = exam.questions.map((q, idx) => {
      const studentAnswer = studentAnswers?.[q.id] ?? null;
      const result = gradeQuestion(q, studentAnswer, negativeMarking);
      autoScore += result.marksAwarded;

      let correctAnswerParsed: unknown = null;
      try { correctAnswerParsed = JSON.parse(q.correctAnswer || 'null'); } catch { correctAnswerParsed = q.correctAnswer; }

      return {
        index: idx + 1,
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        options: safeJsonParse(q.options),
        marks: q.marks,
        marksAwarded: result.marksAwarded,
        isCorrect: result.isCorrect,
        studentAnswer: studentAnswer,
        studentAnswerFormatted: formatAnswer(q.type, studentAnswer),
        correctAnswer: correctAnswerParsed,
        correctAnswerFormatted: formatAnswer(q.type, correctAnswerParsed),
        explanation: q.explanation,
        mediaUrl: q.mediaUrl,
      };
    });

    const percentage = totalMarks > 0 ? Math.round((autoScore / totalMarks) * 100 * 100) / 100 : 0;

    let grade = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';

    const correctedCount = questions.filter(q => q.isCorrect).length;
    const wrongCount = questions.filter(q => q.studentAnswer !== null && !q.isCorrect).length;
    const unansweredCount = questions.filter(q => q.studentAnswer === null || q.studentAnswer === '' || q.studentAnswer === undefined).length;

    return NextResponse.json({
      data: {
        exam: { id: exam.id, name: exam.name, type: exam.type, totalMarks, passingMarks: exam.passingMarks },
        student: { id: attempt.studentId, name: attempt.student.user.name, admissionNo: attempt.student.admissionNo },
        attempt: {
          id: attempt.id,
          status: attempt.status,
          autoScore: attempt.autoScore,
          manualScore: attempt.manualScore,
          finalScore: attempt.finalScore,
          timeTakenSeconds: attempt.timeTakenSeconds,
          tabSwitchCount: attempt.tabSwitchCount,
          submittedAt: attempt.submittedAt,
          gradedAt: attempt.gradedAt,
        },
        summary: {
          autoScore,
          totalMarks,
          percentage,
          grade,
          correctedCount,
          wrongCount,
          unansweredCount,
          totalQuestions: questions.length,
          negativeMarking,
        },
        questions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
