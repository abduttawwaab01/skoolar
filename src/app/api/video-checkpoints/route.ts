import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

// GET /api/video-checkpoints - Get checkpoints for a lesson
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'STUDENT', 'PARENT']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return errorResponse('lessonId is required', 400);
    }

    // Verify the lesson exists and check school isolation
    const lesson = await db.videoLesson.findUnique({
      where: { id: lessonId },
      select: { schoolId: true },
    });

    if (!lesson) {
      return errorResponse('Lesson not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && lesson.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized to access checkpoints for this lesson', 403);
    }

    // Get checkpoints for the lesson
    const checkpoints = await db.videoCheckpoint.findMany({
      where: { lessonId },
      orderBy: { timestamp: 'asc' },
    });

    // If student, also get their progress
    let progressMap: Record<string, { isCorrect: boolean; answer: string }> = {};
    if (auth.role === 'STUDENT' && auth.userId) {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
      });

      if (student) {
        const progress = await db.videoCheckpointProgress.findMany({
          where: {
            studentId: student.id,
            checkpointId: { in: checkpoints.map(c => c.id) },
          },
        });

        progressMap = progress.reduce((acc, p) => {
          acc[p.checkpointId] = { isCorrect: p.isCorrect, answer: p.answer || '' };
          return acc;
        }, {} as Record<string, { isCorrect: boolean; answer: string }>);
      }
    }

    // Strip correctAnswer from response for student/parent roles to prevent cheating
    const isStudentOrParent = auth.role === 'STUDENT' || auth.role === 'PARENT';
    return successResponse(
      checkpoints.map(cp => {
        const result: Record<string, unknown> = {
          ...cp,
          options: cp.options ? JSON.parse(cp.options) : null,
          userAnswer: progressMap[cp.id]?.answer || null,
          userCorrect: progressMap[cp.id]?.isCorrect || null,
        };
        if (isStudentOrParent) delete result.correctAnswer;
        return result;
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// POST /api/video-checkpoints - Create checkpoint (Teacher/Admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const { lessonId, timestamp, question, questionType, options, correctAnswer, explanation, order, isRequired } = body;

    if (!lessonId || !timestamp || !question) {
      return errorResponse('lessonId, timestamp, and question are required', 400);
    }

    // Verify the user can add checkpoint to this lesson
    const lesson = await db.videoLesson.findUnique({
      where: { id: lessonId },
      select: { schoolId: true },
    });

    if (!lesson) {
      return errorResponse('Lesson not found', 404);
    }

    // Verify school access
    if (auth.role !== 'SUPER_ADMIN' && lesson.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized', 403);
    }

    // Validate question type
    const validTypes = ['MCQ', 'TRUE_FALSE'];
    const type = questionType && validTypes.includes(questionType) ? questionType : 'MCQ';

    // Validate options for MCQ
    let processedOptions: string | null = null;
    let processedAnswer: string | null = correctAnswer;

    if (type === 'MCQ') {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return errorResponse('MCQ requires at least 2 options', 400);
      }
      processedOptions = JSON.stringify(options);
      
      // Validate correct answer is a valid index
      const correctIdx = parseInt(correctAnswer);
      if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= options.length) {
        return errorResponse('Invalid correct answer index', 400);
      }
    } else if (type === 'TRUE_FALSE') {
      if (correctAnswer !== 'true' && correctAnswer !== 'false') {
        return errorResponse('TRUE_FALSE requires correctAnswer to be "true" or "false"', 400);
      }
    }

    const checkpoint = await db.videoCheckpoint.create({
      data: {
        lessonId,
        timestamp,
        question,
        questionType: type,
        options: processedOptions,
        correctAnswer: processedAnswer,
        explanation,
        order: order || 0,
        isRequired: isRequired !== false,
      },
    });

    return successResponse({
      ...checkpoint,
      options: processedOptions ? JSON.parse(processedOptions) : null,
    }, 'Checkpoint created successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// PUT /api/video-checkpoints - Update checkpoint
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const { id, timestamp, question, questionType, options, correctAnswer, explanation, order, isRequired } = body;

    if (!id) {
      return errorResponse('Checkpoint ID is required', 400);
    }

    // Verify the checkpoint exists and user has access
    const existing = await db.videoCheckpoint.findUnique({
      where: { id },
      include: { lesson: { select: { schoolId: true } } },
    });

    if (!existing) {
      return errorResponse('Checkpoint not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.lesson.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized', 403);
    }

    // Process options and answer
    let processedOptions: string | null = existing.options;
    let processedAnswer: string | null = correctAnswer;

    if (options) {
      processedOptions = JSON.stringify(options);
    }

    if (questionType === 'MCQ' && options && correctAnswer) {
      const correctIdx = parseInt(correctAnswer);
      const optsArray = Array.isArray(options) ? options : JSON.parse(options);
      if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= optsArray.length) {
        return errorResponse('Invalid correct answer index', 400);
      }
    } else if (questionType === 'TRUE_FALSE' && correctAnswer) {
      if (correctAnswer !== 'true' && correctAnswer !== 'false') {
        return errorResponse('TRUE_FALSE requires correctAnswer to be "true" or "false"', 400);
      }
    }

    const checkpoint = await db.videoCheckpoint.update({
      where: { id },
      data: {
        ...(timestamp !== undefined && { timestamp }),
        ...(question !== undefined && { question }),
        ...(questionType !== undefined && { questionType }),
        ...(processedOptions !== null && { options: processedOptions }),
        ...(processedAnswer !== null && { correctAnswer: processedAnswer }),
        ...(explanation !== undefined && { explanation }),
        ...(order !== undefined && { order }),
        ...(isRequired !== undefined && { isRequired }),
      },
    });

    return successResponse({
      ...checkpoint,
      options: checkpoint.options ? JSON.parse(checkpoint.options) : null,
    }, 'Checkpoint updated successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// DELETE /api/video-checkpoints - Delete checkpoint
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Checkpoint ID is required', 400);
    }

    const existing = await db.videoCheckpoint.findUnique({
      where: { id },
      include: { lesson: { select: { schoolId: true } } },
    });

    if (!existing) {
      return errorResponse('Checkpoint not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.lesson.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized', 403);
    }

    await db.videoCheckpoint.delete({
      where: { id },
    });

    return successResponse(null, 'Checkpoint deleted successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}