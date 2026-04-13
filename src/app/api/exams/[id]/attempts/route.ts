import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Helper: safely parse a JSON string field
function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// ==============================
// GET /api/exams/[id]/attempts - List all attempts (teacher view)
// ==============================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        totalMarks: true,
        passingMarks: true,
        classId: true,
        isPublished: true,
        _count: {
          select: { attempts: true },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      examId: id,
    };

    if (status) {
      where.status = status;
    }

    // Fetch attempts with pagination and student info
    const [attempts, total] = await Promise.all([
      db.examAttempt.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              isActive: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  avatar: true,
                },
              },
              class: {
                select: {
                  name: true,
                  section: true,
                  grade: true,
                },
              },
            },
          },
        },
      }),
      db.examAttempt.count({ where }),
    ]);

    // Parse JSON fields and compute per-attempt details
    const processedAttempts = attempts.map((a) => ({
      id: a.id,
      examId: a.examId,
      studentId: a.studentId,
      student: a.student,
      autoScore: a.autoScore,
      manualScore: a.manualScore,
      finalScore: a.finalScore ?? a.autoScore,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      gradedAt: a.gradedAt,
      tabSwitchCount: a.tabSwitchCount,
      timeTakenSeconds: a.timeTakenSeconds,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      securityViolations: safeJsonParse(a.securityViolations),
    }));

    // Calculate aggregate stats across ALL attempts (not just this page)
    const allAttemptsForStats = await db.examAttempt.findMany({
      where: { examId: id },
      select: {
        status: true,
        autoScore: true,
        finalScore: true,
      },
    });

    const submittedAttempts = allAttemptsForStats.filter(
      (a) => a.status === 'submitted' || a.status === 'graded'
    );
    const gradedAttempts = allAttemptsForStats.filter(
      (a) => a.status === 'graded'
    );

    const scoresWithFinal = allAttemptsForStats
      .filter((a) => a.status === 'submitted' || a.status === 'graded')
      .map((a) => a.finalScore ?? a.autoScore ?? 0);

    const avgScore = scoresWithFinal.length > 0
      ? Math.round((scoresWithFinal.reduce((sum, s) => sum + s, 0) / scoresWithFinal.length) * 100) / 100
      : 0;

    // Pass rate based on exam passingMarks / totalMarks ratio
    const passThreshold = exam.totalMarks > 0
      ? (exam.passingMarks / exam.totalMarks) * 100
      : 50;

    const scoresAsPercentage = allAttemptsForStats
      .filter((a) => a.status === 'submitted' || a.status === 'graded')
      .map((a) => {
        const score = a.finalScore ?? a.autoScore ?? 0;
        return exam.totalMarks > 0 ? (score / exam.totalMarks) * 100 : 0;
      });

    const passRate = scoresAsPercentage.length > 0
      ? Math.round(
          (scoresAsPercentage.filter((p) => p >= passThreshold).length / scoresAsPercentage.length) * 100
        )
      : 0;

    const stats = {
      total: allAttemptsForStats.length,
      inProgress: allAttemptsForStats.filter((a) => a.status === 'in_progress').length,
      submitted: submittedAttempts.length,
      graded: gradedAttempts.length,
      timedOut: allAttemptsForStats.filter((a) => a.status === 'timed_out').length,
      disqualified: allAttemptsForStats.filter((a) => a.status === 'disqualified').length,
      avgScore,
      passRate,
    };

    return NextResponse.json({
      data: processedAttempts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
