import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

// GET /api/lesson-plans/[id]/students — teacher/parent view: all student attempts for this plan
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const plan = await db.lessonPlan.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && plan.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only teachers, admins, directors, parents can view student results
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER', 'PARENT'].includes(auth.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get all attempts with student info (include user for name)
    const attempts = await db.lessonPlanAttempt.findMany({
      where: { planId: id },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: [{ studentId: 'asc' }, { attemptNumber: 'desc' }],
    });

    // Group attempts by student
    const studentMap = new Map<string, {
      student: typeof attempts[0]['student'];
      attempts: typeof attempts;
      bestScore: number;
      bestMastery: string;
      totalAttempts: number;
    }>();

    for (const a of attempts) {
      const sid = a.studentId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          student: a.student,
          attempts: [],
          bestScore: 0,
          bestMastery: 'beginner',
          totalAttempts: 0,
        });
      }
      const entry = studentMap.get(sid)!;
      entry.attempts.push(a);
      entry.totalAttempts++;
      if (a.score && a.score > entry.bestScore) {
        entry.bestScore = a.score;
        entry.bestMastery = a.masteryLevel || 'beginner';
      }
    }

    const students = Array.from(studentMap.values());

    return NextResponse.json({
      data: {
        plan,
        students,
        totalStudents: students.length,
        totalAttempts: attempts.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
