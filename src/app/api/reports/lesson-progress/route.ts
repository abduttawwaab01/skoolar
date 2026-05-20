import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSchoolId } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

// GET /api/reports/lesson-progress?lessonId=xxx — student progress report for a lesson
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId') || '';
    const classId = searchParams.get('classId') || '';
    const schoolId = getSchoolId(request, auth) || auth.schoolId || '';

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    // Verify lesson belongs to school
    const lesson = await db.videoLesson.findUnique({
      where: { id: lessonId },
      select: { schoolId: true, title: true, classId: true, duration: true },
    });
    if (!lesson) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && lesson.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get checkpoints for this lesson
    const checkpoints = await db.videoCheckpoint.findMany({
      where: { lessonId },
      orderBy: { timestamp: 'asc' },
      select: { id: true, question: true, timestamp: true },
    });

    // Get student progress for this lesson
    const progressRecords = await db.studentVideoProgress.findMany({
      where: { lessonId },
      select: {
        studentId: true,
        progress: true,
        completed: true,
        lastWatchedAt: true,
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { name: true } },
            classId: true,
            class: { select: { name: true } },
          },
        },
      },
    });

    // Get checkpoint progress for all students
    const checkpointProgress = await db.videoCheckpointProgress.findMany({
      where: {
        checkpointId: { in: checkpoints.map(c => c.id) },
      },
      select: {
        studentId: true,
        checkpointId: true,
        isCorrect: true,
        answeredAt: true,
      },
    });

    // Get lesson plan quiz attempts for the school
    const lessonPlanAttempts = await db.lessonPlanAttempt.findMany({
      where: {
        schoolId,
        lessonPlan: lesson.classId ? {
          classId: lesson.classId,
        } : undefined,
      },
      select: {
        studentId: true,
        score: true,
        totalMarks: true,
        passed: true,
        completedAt: true,
        lessonPlan: { select: { id: true, topic: true } },
      },
    });

    // Build per-student report
    const studentMap = new Map<string, {
      studentName: string;
      admissionNo: string;
      className: string;
      progress: number;
      completed: boolean;
      lastWatched: string | null;
      checkpoints: { id: string; question: string; timestamp: number; correct: boolean; answered: boolean }[];
      quizScore: number | null;
      quizTotal: number | null;
      quizPassed: boolean | null;
    }>();

    // Initialize from progress records
    for (const pr of progressRecords) {
      studentMap.set(pr.studentId, {
        studentName: pr.student.user?.name || 'Unknown',
        admissionNo: pr.student.admissionNo || '',
        className: pr.student.class?.name || '',
        progress: pr.progress,
        completed: pr.completed,
        lastWatched: pr.lastWatchedAt?.toISOString() || null,
        checkpoints: checkpoints.map(cp => ({
          id: cp.id,
          question: cp.question,
          timestamp: cp.timestamp,
          correct: false,
          answered: false,
        })),
        quizScore: null,
        quizTotal: null,
        quizPassed: null,
      });
    }

    // Fill in checkpoint data
    for (const cp of checkpointProgress) {
      const student = studentMap.get(cp.studentId);
      if (student) {
        const cpEntry = student.checkpoints.find(c => c.id === cp.checkpointId);
        if (cpEntry) {
          cpEntry.correct = cp.isCorrect;
          cpEntry.answered = true;
        }
      }
    }

    // Fill in quiz data
    for (const la of lessonPlanAttempts) {
      const student = studentMap.get(la.studentId);
      if (student) {
        student.quizScore = la.score || 0;
        student.quizTotal = la.totalMarks || 0;
        student.quizPassed = la.passed;
      }
    }

    const students = Array.from(studentMap.values());

    // Compute aggregate stats
    const totalStudents = students.length;
    const completedCount = students.filter(s => s.completed).length;
    const checkpointPassRates = checkpoints.map(cp => {
      const answers = checkpointProgress.filter(cp2 => cp2.checkpointId === cp.id);
      const correctCount = answers.filter(a => a.isCorrect).length;
      return {
        checkpointId: cp.id,
        question: cp.question,
        timestamp: cp.timestamp,
        totalAnswers: answers.length,
        correctCount,
        passRate: answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0,
      };
    });

    return NextResponse.json({
      data: {
        lesson: { id: lessonId, title: lesson.title, duration: lesson.duration },
        summary: {
          totalStudents,
          completedCount,
          completionRate: totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0,
          avgProgress: totalStudents > 0
            ? Math.round(students.reduce((a, s) => a + s.progress, 0) / totalStudents)
            : 0,
        },
        checkpointPassRates,
        students,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
