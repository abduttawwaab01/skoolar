import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

// GET /api/lesson-plans/[id]/attempt?studentId=xxx — get student attempt
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';

    // Get the lesson plan
    const plan = await db.lessonPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    // Check school isolation
    if (auth.role !== 'SUPER_ADMIN' && plan.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // If student is requesting, use their own ID
    const targetStudentId = studentId || auth.userId || '';
    if (!targetStudentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    // Get existing attempt
    const attempt = await db.lessonPlanAttempt.findUnique({
      where: { planId_studentId: { planId: id, studentId: targetStudentId } },
    });

    // Parse quiz questions
    const quiz = plan.quiz ? JSON.parse(plan.quiz) : [];

    return NextResponse.json({
      data: {
        quiz,
        attempt: attempt ? {
          ...attempt,
          answers: attempt.answers ? JSON.parse(attempt.answers) : null,
        } : null,
        totalQuestions: quiz.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/lesson-plans/[id]/attempt — submit quiz attempt
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = await request.json();
    const { studentId, answers } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    // Get the lesson plan with quiz
    const plan = await db.lessonPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && plan.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!plan.quiz) {
      return NextResponse.json({ error: 'No quiz defined for this lesson plan' }, { status: 400 });
    }

    const quiz = JSON.parse(plan.quiz);
    if (!Array.isArray(quiz) || quiz.length === 0) {
      return NextResponse.json({ error: 'No questions in quiz' }, { status: 400 });
    }

    // Auto-grade the answers
    let score = 0;
    let totalMarks = 0;
    const parsedAnswers: Record<string, unknown> = answers || {};

    for (let i = 0; i < quiz.length; i++) {
      const q = quiz[i];
      const marks = q.marks || 1;
      totalMarks += marks;
      const studentAnswer = parsedAnswers[String(i)];
      if (studentAnswer !== undefined && String(studentAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) {
        score += marks;
      }
    }

    const passed = totalMarks > 0 ? (score / totalMarks) * 100 >= 60 : false;

    // Upsert the attempt
    const attempt = await db.lessonPlanAttempt.upsert({
      where: { planId_studentId: { planId: id, studentId } },
      update: {
        answers: JSON.stringify(parsedAnswers),
        score,
        totalMarks,
        passed,
        completedAt: new Date(),
      },
      create: {
        planId: id,
        schoolId: plan.schoolId,
        studentId,
        answers: JSON.stringify(parsedAnswers),
        score,
        totalMarks,
        passed,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        ...attempt,
        answers: JSON.parse(attempt.answers || '{}'),
      },
      score,
      totalMarks,
      passed,
      message: passed ? 'Quiz passed!' : 'Quiz failed. Review the lesson and try again.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
