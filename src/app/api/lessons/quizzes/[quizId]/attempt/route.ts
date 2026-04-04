import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

// GET /api/lessons/quizzes/[quizId]/attempt - Get quiz attempts or start new
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';

    const quiz = await db.lessonQuiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // If studentId provided, find existing attempt
    if (studentId) {
      const existingAttempt = await db.lessonQuizAttempt.findFirst({
        where: { quizId, studentId },
        orderBy: { createdAt: 'desc' },
      });

      if (existingAttempt) {
        return NextResponse.json({
          data: {
            attempt: existingAttempt,
            quiz: {
              id: quiz.id,
              title: quiz.title,
              timeLimit: quiz.timeLimit,
              passingScore: quiz.passingScore,
              questions: quiz.questions,
            },
          },
        });
      }
    }

    return NextResponse.json({
      data: {
        attempt: null,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          timeLimit: quiz.timeLimit,
          passingScore: quiz.passingScore,
          questions: quiz.questions,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/lessons/quizzes/[quizId]/attempt - Start or submit a quiz attempt
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const body = await request.json();

    const { studentId, answers, action } = body as {
      studentId: string;
      answers?: Record<string, unknown>;
      action?: 'start' | 'submit';
    };

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const quiz = await db.lessonQuiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (action === 'submit' && answers) {
      // Find existing attempt
      const existingAttempt = await db.lessonQuizAttempt.findFirst({
        where: { quizId, studentId },
      });

      if (!existingAttempt) {
        return NextResponse.json({ error: 'No active attempt found. Start the quiz first.' }, { status: 400 });
      }

      if (existingAttempt.status === 'submitted') {
        return NextResponse.json({ error: 'Quiz already submitted' }, { status: 400 });
      }

      // Auto-grade objective questions
      let autoScore = 0;
      let totalMarks = 0;

      quiz.questions.forEach(q => {
        totalMarks += q.marks;
        const studentAnswer = answers[q.id];
        const correctAnswer = safeJsonParse(q.correctAnswer);

        if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') {
          if (String(studentAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim()) {
            autoScore += q.marks;
          }
        } else if (q.type === 'MULTI_SELECT') {
          const studentArr = Array.isArray(studentAnswer) ? studentAnswer.map(String).sort() : [];
          const correctArr = Array.isArray(correctAnswer) ? (correctAnswer as string[]).map(String).sort() : [];
          if (JSON.stringify(studentArr) === JSON.stringify(correctArr)) {
            autoScore += q.marks;
          }
        } else if (q.type === 'FILL_BLANK') {
          // Accept multiple acceptable answers (array) or single string
          if (Array.isArray(correctAnswer)) {
            const match = (correctAnswer as string[]).some(a =>
              String(studentAnswer).toLowerCase().trim() === a.toLowerCase().trim()
            );
            if (match) autoScore += q.marks;
          } else if (String(studentAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim()) {
            autoScore += q.marks;
          }
        } else if (q.type === 'SHORT_ANSWER') {
          // Fuzzy match: case-insensitive, trim whitespace
          if (String(studentAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim()) {
            autoScore += q.marks;
          }
        } else if (q.type === 'MATCHING') {
          // Compare matching pairs JSON
          try {
            const studentPairs = safeJsonParse(String(studentAnswer));
            if (studentPairs && correctAnswer) {
              const studentSorted = JSON.stringify(studentPairs);
              const correctSorted = JSON.stringify(correctAnswer);
              if (studentSorted === correctSorted) autoScore += q.marks;
            }
          } catch { /* no match */ }
        }
        // ESSAY requires manual grading - score stays 0
      });

      const percentage = totalMarks > 0 ? Math.round((autoScore / totalMarks) * 100) : 0;
      const passed = percentage >= quiz.passingScore;

      const updatedAttempt = await db.lessonQuizAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          answers: JSON.stringify(answers),
          score: autoScore,
          totalMarks,
          percentage,
          passed,
          status: 'submitted',
        },
      });

      return NextResponse.json({
        data: {
          attempt: updatedAttempt,
          score: autoScore,
          totalMarks,
          percentage,
          passed,
          autoGraded: true,
        },
        message: passed ? 'Congratulations! You passed the quiz!' : 'Quiz submitted. Review the lesson and try again.',
      });
    }

    // Start new attempt
    const existingActive = await db.lessonQuizAttempt.findFirst({
      where: { quizId, studentId, status: 'in_progress' },
    });

    if (existingActive) {
      return NextResponse.json({
        data: { attempt: existingActive },
        message: 'Resuming existing attempt',
      });
    }

    const attempt = await db.lessonQuizAttempt.create({
      data: {
        quizId,
        studentId,
        status: 'in_progress',
        totalMarks: 0,
      },
    });

    return NextResponse.json(
      {
        data: {
          attempt,
          quiz: {
            id: quiz.id,
            title: quiz.title,
            timeLimit: quiz.timeLimit,
            passingScore: quiz.passingScore,
            questions: quiz.questions,
          },
        },
        message: 'Quiz started!',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
