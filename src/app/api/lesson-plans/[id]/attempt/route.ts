import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

// Mastery level configuration (default thresholds)
const DEFAULT_THRESHOLDS = { beginner: 0, intermediate: 40, advanced: 60, mastered: 80 };

function getMasteryLevel(score: number, totalMarks: number, thresholdsJson: string | null): string {
  if (totalMarks <= 0) return 'beginner';
  const pct = (score / totalMarks) * 100;
  const t = thresholdsJson ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(thresholdsJson) } : DEFAULT_THRESHOLDS;
  if (pct >= t.mastered) return 'mastered';
  if (pct >= t.advanced) return 'advanced';
  if (pct >= t.intermediate) return 'intermediate';
  return 'beginner';
}

// GET /api/lesson-plans/[id]/attempt?studentId=xxx — get all attempts for a student
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

    const plan = await db.lessonPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && plan.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const targetStudentId = studentId || auth.userId || '';
    if (!targetStudentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    // Get all attempts for this student, ordered by attempt number desc
    const attempts = await db.lessonPlanAttempt.findMany({
      where: { planId: id, studentId: targetStudentId },
      orderBy: { attemptNumber: 'desc' },
    });

    // Parse quiz questions
    const quiz = plan.quiz ? JSON.parse(plan.quiz) : [];

    return NextResponse.json({
      data: {
        quiz,
        attempts: attempts.map(a => ({
          ...a,
          answers: a.answers ? JSON.parse(a.answers) : null,
        })),
        totalQuestions: quiz.length,
        thresholds: plan.masteryThresholds ? JSON.parse(plan.masteryThresholds) : DEFAULT_THRESHOLDS,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/lesson-plans/[id]/attempt — submit a quiz attempt (supports re-attempts)
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

    const plan = await db.lessonPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

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
    const masteryLevel = getMasteryLevel(score, totalMarks, plan.masteryThresholds);

    // Find the latest attempt number for this student
    const latestAttempt = await db.lessonPlanAttempt.findFirst({
      where: { planId: id, studentId },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });
    const attemptNumber = (latestAttempt?.attemptNumber || 0) + 1;

    // Create a new attempt (always creates new record for re-attempts)
    const attempt = await db.lessonPlanAttempt.create({
      data: {
        planId: id,
        schoolId: plan.schoolId,
        studentId,
        attemptNumber,
        answers: JSON.stringify(parsedAnswers),
        score,
        totalMarks,
        masteryLevel,
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
      masteryLevel,
      passed,
      attemptNumber,
      message: passed
        ? `Quiz passed! Mastery level: ${masteryLevel}`
        : `Quiz score: ${Math.round((score / totalMarks) * 100)}%. Review the lesson and try again.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
