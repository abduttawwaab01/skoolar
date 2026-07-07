import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth-middleware';
import { notifyStudentAndParents } from '@/lib/notifications';

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
// GET /api/exams/[id]/grade - Get attempts needing manual grading
// ==============================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['TEACHER', 'DIRECTOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: auth.role === 'SUPER_ADMIN' ? { id } : { id, schoolId: auth.schoolId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Get all attempts for this exam
    const attempts = await db.examAttempt.findMany({
      where: { examId: id },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { name: true, email: true, avatar: true } },
            class: { select: { name: true, section: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Parse answers and identify questions needing manual grading
    const subjectiveTypes = ['SHORT_ANSWER', 'ESSAY', 'MATCHING'];

    const processed = attempts.map((attempt) => {
      const answers = safeJsonParse(attempt.answers) as Record<string, unknown> | null;

      // Build per-question grading data
      const questionGrading = exam.questions.map((q) => {
        const studentAnswer = answers?.[q.id] ?? null;
        const isSubjective = subjectiveTypes.includes(q.type);

        return {
          questionId: q.id,
          type: q.type,
          questionText: q.questionText,
          marks: q.marks,
          options: safeJsonParse(q.options),
          correctAnswer: safeJsonParse(q.correctAnswer),
          studentAnswer,
          isSubjective,
          needsManualGrading: isSubjective && studentAnswer !== null && studentAnswer !== '',
        };
      });

      return {
        id: attempt.id,
        studentId: attempt.studentId,
        student: attempt.student,
        status: attempt.status,
        autoScore: attempt.autoScore,
        manualScore: attempt.manualScore,
        finalScore: attempt.finalScore,
        timeTakenSeconds: attempt.timeTakenSeconds,
        tabSwitchCount: attempt.tabSwitchCount,
        securityViolations: safeJsonParse(attempt.securityViolations),
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        answers,
        questionGrading,
        needsManualGrading: questionGrading.some((q) => q.needsManualGrading),
      };
    });

    return NextResponse.json({
      data: processed,
      total: processed.length,
      exam: {
        id: exam.id,
        name: exam.name,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        questionCount: exam.questions.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==============================
// POST /api/exams/[id]/grade - Save manual grades
// ==============================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const body = await request.json();

    const examCheck = await db.exam.findUnique({
      where: authResult.role === 'SUPER_ADMIN' ? { id } : { id, schoolId: authResult.schoolId },
      select: { schoolId: true },
    });
    if (!examCheck) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const { attemptId, scores, finalManualScore } = body as {
      attemptId?: string;
      scores?: Record<string, number>; // questionId -> score
      finalManualScore?: number;
    };

    if (!attemptId) {
      return NextResponse.json(
        { error: 'attemptId is required' },
        { status: 400 }
      );
    }

    // Verify attempt belongs to this exam
    const attempt = await db.examAttempt.findFirst({
      where: { id: attemptId, examId: id },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Attempt not found or does not belong to this exam' },
        { status: 404 }
      );
    }

    // Calculate manual score from per-question scores
    let manualScore = finalManualScore;
    if (!manualScore && scores) {
      manualScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
    }

    // Get exam for final score calculation
    const exam = await db.exam.findUnique({
      where: { id },
      select: { name: true, totalMarks: true, passingMarks: true, negativeMarking: true, schoolId: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Calculate final score: autoScore + manualScore - penalty for tab switches
    const autoScore = attempt.autoScore || 0;
    const tabPenalty = exam.negativeMarking > 0
      ? (attempt.tabSwitchCount || 0) * exam.negativeMarking
      : 0;
    const finalScore = Math.max(0, autoScore + (manualScore || 0) - tabPenalty);

    // Update attempt
    const updatedAttempt = await db.examAttempt.update({
      where: { id: attemptId },
      data: {
        manualScore: manualScore || 0,
        finalScore,
        status: 'graded',
        gradedAt: new Date(),
      },
    });

    // Update ExamScore
    const percentage = exam.totalMarks > 0
      ? Math.round((finalScore / exam.totalMarks) * 100 * 100) / 100
      : 0;
    const passed = percentage >= (exam.passingMarks / exam.totalMarks) * 100;

    let grade = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else if (percentage >= 50) grade = 'D';

    await db.examScore.upsert({
      where: {
        examId_studentId: { examId: id, studentId: attempt.studentId },
      },
      update: {
        score: finalScore,
        grade,
      },
      create: {
        examId: id,
        studentId: attempt.studentId,
        score: finalScore,
        grade,
      },
    });

    // Notify student and parents about graded exam
    notifyStudentAndParents(
      attempt.studentId,
      examCheck.schoolId,
      `Exam Graded: ${exam.name}`,
      `Your ${exam.name} exam has been graded. Score: ${finalScore}/${exam.totalMarks} (${grade})`,
      {
        type: 'success',
        category: 'exam',
        actionUrl: `/dashboard?view=results`,
      }
    ).catch(() => {});

    return NextResponse.json({
      data: {
        attempt: updatedAttempt,
        manualScore,
        autoScore,
        tabPenalty,
        finalScore,
        grade,
        passed,
        percentage,
      },
      message: 'Grading saved successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
