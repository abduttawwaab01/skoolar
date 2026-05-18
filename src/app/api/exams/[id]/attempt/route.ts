import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// Helper: safely parse a JSON string field
function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Helper: auto-grade objective questions
function gradeObjectiveQuestion(
  question: {
    id: string;
    type: string;
    correctAnswer: string | null;
    marks: number;
  },
  answer: unknown,
  negativeMarking: number = 0
): number {
  if (!question.correctAnswer) return 0;

  let correctAnswer: unknown;
  try {
    correctAnswer = JSON.parse(question.correctAnswer);
  } catch {
    correctAnswer = question.correctAnswer;
  }

  // No answer provided
  if (answer === undefined || answer === null || answer === '') return 0;

  const deduction = negativeMarking > 0 ? -(question.marks * negativeMarking) : 0;

  switch (question.type) {
    case 'MCQ': {
      // MCQ: exact match (string comparison)
      const studentAnswer = String(answer).trim();
      const correct = String(correctAnswer).trim();
      return studentAnswer === correct ? question.marks : deduction;
    }

    case 'MULTI_SELECT': {
      // MULTI_SELECT: both arrays must contain same elements (order-insensitive)
      const studentArr = Array.isArray(answer) ? answer.map(String).sort() : [];
      const correctArr = Array.isArray(correctAnswer) ? (correctAnswer as unknown[]).map(String).sort() : [];
      return JSON.stringify(studentArr) === JSON.stringify(correctArr) ? question.marks : deduction;
    }

    case 'TRUE_FALSE': {
      // TRUE_FALSE: exact match
      const studentAnswer = String(answer).trim().toLowerCase();
      const correct = String(correctAnswer).trim().toLowerCase();
      return studentAnswer === correct ? question.marks : deduction;
    }

    case 'FILL_BLANK': {
      // FILL_BLANK: case-insensitive exact match against any acceptable answer
      const studentAnswer = String(answer).trim().toLowerCase();
      const acceptableAnswers = Array.isArray(correctAnswer)
        ? (correctAnswer as unknown[]).map((a) => String(a).trim().toLowerCase())
        : [String(correctAnswer).trim().toLowerCase()];

      return acceptableAnswers.includes(studentAnswer) ? question.marks : deduction;
    }

    default:
      // SHORT_ANSWER, ESSAY, MATCHING are subjective - skip auto-grading
      return 0;
  }
}

// ==============================
// POST /api/exams/[id]/attempt
// - action=submit: Submit exam (auto-grade + finalize)
// - No action: Start or resume exam attempt
// ==============================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await request.json();

    const { studentId, action } = body as { studentId?: string; action?: string };

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      );
    }

    // Fetch exam with questions
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // School isolation
    let student, schoolIdForCheck;

    if (auth.role !== 'SUPER_ADMIN') {
      // Get student with user info for ownership check
      student = await db.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { id: true, schoolId: true } } },
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      schoolIdForCheck = auth.schoolId;
      // SUPER_ADMIN can act on any school
      if (auth.role !== 'SUPER_ADMIN' && schoolIdForCheck && student.user.schoolId !== schoolIdForCheck) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (auth.role !== 'SUPER_ADMIN' && schoolIdForCheck && exam.schoolId !== schoolIdForCheck) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // STUDENT role can only attempt for themselves
      if (auth.role === 'STUDENT') {
        const authStudent = await db.student.findFirst({
          where: { userId: auth.userId },
          select: { id: true },
        });
        if (!authStudent || authStudent.id !== studentId) {
          return NextResponse.json({ error: 'You can only attempt exams for yourself' }, { status: 403 });
        }
      }
    } else {
      student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
    }

    // ---- SUBMIT action ----
    if (action === 'submit') {
      // Find existing attempt
      const attempt = await db.examAttempt.findUnique({
        where: {
          examId_studentId: { examId: id, studentId },
        },
      });

      if (!attempt) {
        return NextResponse.json(
          { error: 'No active attempt found for this exam' },
          { status: 404 }
        );
      }

      if (attempt.status !== 'in_progress') {
        return NextResponse.json(
          { error: `Cannot submit exam. Attempt status is "${attempt.status}"` },
          { status: 400 }
        );
      }

      // Calculate time taken
      const timeTakenSeconds = Math.round(
        (new Date().getTime() - attempt.startedAt.getTime()) / 1000
      );

      // Parse student answers
      const studentAnswers = safeJsonParse(attempt.answers) as Record<string, unknown> | null;

      // Auto-grade objective questions with optional negative marking
      const negativeMarking = exam.negativeMarking || 0;
      let autoScore = 0;
      const questionResults: { questionId: string; type: string; marksAwarded: number; isCorrect: boolean }[] = [];

      for (const question of exam.questions) {
        const studentAnswer = studentAnswers?.[question.id];
        const marksAwarded = gradeObjectiveQuestion(question, studentAnswer, negativeMarking);

        autoScore += marksAwarded;

        questionResults.push({
          questionId: question.id,
          type: question.type,
          marksAwarded,
          isCorrect: marksAwarded > 0,
        });
      }

      // Calculate percentage and grade
      const totalMarks = exam.questions.reduce((sum, q) => sum + q.marks, 0);
      const percentage = totalMarks > 0 ? Math.round((autoScore / totalMarks) * 100 * 100) / 100 : 0;
      const passed = percentage >= (exam.passingMarks / exam.totalMarks) * 100;

      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';

      // Update attempt status with finalScore synced
      const updatedAttempt = await db.examAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
          timeTakenSeconds,
          autoScore,
          finalScore: autoScore,
        },
      });

      // Create or update ExamScore record with grade
      await db.examScore.upsert({
        where: {
          examId_studentId: { examId: id, studentId },
        },
        update: {
          score: autoScore,
          grade,
        },
        create: {
          examId: id,
          studentId,
          score: autoScore,
          grade,
        },
      });

      return NextResponse.json({
        data: {
          attempt: {
            ...updatedAttempt,
            answers: safeJsonParse(updatedAttempt.answers),
            securityViolations: safeJsonParse(updatedAttempt.securityViolations),
          },
          autoScore,
          totalMarks,
          percentage,
          passed,
          questionResults,
        },
        message: 'Exam submitted successfully',
      });
    }

    // ---- START / RESUME action ----

    // Check exam is not locked
    if (exam.isLocked) {
      return NextResponse.json(
        { error: 'This exam is locked and cannot be taken' },
        { status: 403 }
      );
    }

    // Check exam is published
    if (!exam.isPublished) {
      return NextResponse.json(
        { error: 'This exam is not yet published' },
        { status: 403 }
      );
    }

    // Check exam date (if set, exam must be today or past start time)
    if (exam.date) {
      const now = new Date();
      // Compare dates only (not time) - exam must be on or before today
      const examDate = new Date(exam.date);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const examDayStart = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());

      if (examDayStart > todayStart) {
        return NextResponse.json(
          { error: 'This exam has not started yet' },
          { status: 403 }
        );
      }
    }

    // Check for existing attempt
    const existingAttempt = await db.examAttempt.findUnique({
      where: {
        examId_studentId: { examId: id, studentId },
      },
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'in_progress') {
        // Resume existing attempt
        const attemptData: Record<string, unknown> = {
          ...existingAttempt,
          answers: safeJsonParse(existingAttempt.answers),
          securityViolations: safeJsonParse(existingAttempt.securityViolations),
        };

        return NextResponse.json({
          data: {
            attempt: attemptData,
            exam: {
              ...exam,
              questions: exam.questions.map((q) => {
                const parsed: Record<string, unknown> = {
                  id: q.id,
                  type: q.type,
                  questionText: q.questionText,
                  marks: q.marks,
                  explanation: q.explanation,
                  mediaUrl: q.mediaUrl,
                  order: q.order,
                  options: safeJsonParse(q.options),
                };
                return parsed;
              }),
              securitySettings: safeJsonParse(exam.securitySettings),
            },
          },
          message: 'Exam attempt resumed',
        });
      }

      if (existingAttempt.status === 'submitted' || existingAttempt.status === 'graded') {
        return NextResponse.json(
          { error: `You have already ${existingAttempt.status} this exam` },
          { status: 400 }
        );
      }

      // timed_out or disqualified
      return NextResponse.json(
        { error: `Your previous attempt ended with status "${existingAttempt.status}"` },
        { status: 400 }
      );
    }

    // Create new attempt
    const newAttempt = await db.examAttempt.create({
      data: {
        examId: id,
        studentId,
        status: 'in_progress',
      },
    });

    const attemptData: Record<string, unknown> = {
      ...newAttempt,
      answers: safeJsonParse(newAttempt.answers),
      securityViolations: safeJsonParse(newAttempt.securityViolations),
    };

    return NextResponse.json({
      data: {
        attempt: attemptData,
        exam: {
          ...exam,
          questions: exam.questions.map((q) => {
            const parsed: Record<string, unknown> = {
              id: q.id,
              type: q.type,
              questionText: q.questionText,
              marks: q.marks,
              explanation: q.explanation,
              mediaUrl: q.mediaUrl,
              order: q.order,
              options: safeJsonParse(q.options),
            };
            return parsed;
          }),
          securitySettings: safeJsonParse(exam.securitySettings),
        },
      },
      message: 'Exam attempt started',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ==============================
// PUT /api/exams/[id]/attempt - Save answers (auto-save)
// ==============================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await request.json();

    const {
      studentId,
      answers,
      tabSwitchCount,
      securityViolations,
    } = body as {
      studentId?: string;
      answers?: Record<string, unknown>;
      tabSwitchCount?: number;
      securityViolations?: unknown;
    };

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      );
    }

    // Verify exam exists
    const exam = await db.exam.findUnique({
      where: { id },
      select: { id: true, schoolId: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // School isolation and student ownership check
    if (auth.role !== 'SUPER_ADMIN') {
      if (auth.schoolId && exam.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (auth.role === 'STUDENT') {
        const authStudent = await db.student.findFirst({
          where: { userId: auth.userId },
          select: { id: true },
        });
        if (!authStudent || authStudent.id !== studentId) {
          return NextResponse.json({ error: 'You can only save your own attempts' }, { status: 403 });
        }
      }
    }

    // Find or create attempt
    let attempt = await db.examAttempt.findUnique({
      where: {
        examId_studentId: { examId: id, studentId },
      },
    });

    if (!attempt) {
      // Auto-create attempt if not exists
      attempt = await db.examAttempt.create({
        data: {
          examId: id,
          studentId,
          status: 'in_progress',
        },
      });
    }

    // Only allow saving answers for in_progress attempts
    if (attempt.status !== 'in_progress') {
      return NextResponse.json(
        { error: `Cannot save answers. Attempt status is "${attempt.status}"` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (answers !== undefined) {
      updateData.answers = JSON.stringify(answers);
    }

    if (tabSwitchCount !== undefined) {
      updateData.tabSwitchCount = tabSwitchCount;
    }

    if (securityViolations !== undefined) {
      updateData.securityViolations = JSON.stringify(securityViolations);
    }

    // Server-side security enforcement: auto-submit if tab switches exceed threshold
    const examSecurity = await db.examSecuritySettings.findUnique({
      where: { examId: id },
    });

    if (
      examSecurity &&
      examSecurity.tabSwitchAutoSubmit &&
      examSecurity.maxTabSwitches &&
      (tabSwitchCount ?? 0) >= examSecurity.maxTabSwitches
    ) {
      updateData.status = 'submitted';
      updateData.submittedAt = new Date();
      // Ensure autoScore is computed before submission
      if (!attempt.autoScore) {
        const fullExam = await db.exam.findUnique({
          where: { id },
          include: { questions: true },
        });
        if (fullExam) {
          const studentAnswers = safeJsonParse(attempt.answers || '{}') as Record<string, unknown> | null;
          const negativeMarking = fullExam.negativeMarking || 0;
          let autoScore = 0;
          for (const question of fullExam.questions) {
            const studentAnswer = studentAnswers?.[question.id];
            autoScore += gradeObjectiveQuestion(question, studentAnswer, negativeMarking);
          }
          updateData.autoScore = autoScore;
        }
      }
    }

    // Update the attempt
    const updatedAttempt = await db.examAttempt.update({
      where: { id: attempt.id },
      data: updateData,
    });

    const responseData: Record<string, unknown> = {
      ...updatedAttempt,
      answers: safeJsonParse(updatedAttempt.answers),
      securityViolations: safeJsonParse(updatedAttempt.securityViolations),
    };

    return NextResponse.json({
      data: responseData,
      message: 'Answers saved successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
