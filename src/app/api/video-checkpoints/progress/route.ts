import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

// POST /api/video-checkpoints/progress - Submit checkpoint answer
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['STUDENT']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const { checkpointId, answer } = body;

    if (!checkpointId || answer === undefined) {
      return errorResponse('checkpointId and answer are required', 400);
    }

    // Get the student profile
    const student = await db.student.findUnique({
      where: { userId: auth.userId },
    });

    if (!student) {
      return errorResponse('Student profile not found', 404);
    }

    // Get checkpoint to validate answer
    const checkpoint = await db.videoCheckpoint.findUnique({
      where: { id: checkpointId },
      include: { lesson: { select: { schoolId: true } } },
    });

    if (!checkpoint) {
      return errorResponse('Checkpoint not found', 404);
    }

    // School isolation check
    if (auth.role !== 'SUPER_ADMIN' && checkpoint.lesson.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized to submit answers for this checkpoint', 403);
    }

    // Check if student already answered this checkpoint
    const existingProgress = await db.videoCheckpointProgress.findUnique({
      where: {
        studentId_checkpointId: {
          studentId: student.id,
          checkpointId,
        },
      },
    });

    // Determine if answer is correct
    let isCorrect = false;
    
    if (checkpoint.questionType === 'MCQ') {
      const correctIdx = parseInt(checkpoint.correctAnswer || '0');
      const answerIdx = parseInt(answer);
      isCorrect = !isNaN(answerIdx) && answerIdx === correctIdx;
    } else if (checkpoint.questionType === 'TRUE_FALSE') {
      const normalizedAnswer = String(answer).toLowerCase().trim();
      isCorrect = normalizedAnswer === checkpoint.correctAnswer?.toLowerCase();
    }

    // Save or update progress
    const progress = existingProgress
      ? await db.videoCheckpointProgress.update({
          where: { id: existingProgress.id },
          data: {
            answer: String(answer),
            isCorrect,
            answeredAt: new Date(),
          },
        })
      : await db.videoCheckpointProgress.create({
          data: {
            studentId: student.id,
            checkpointId,
            answer: String(answer),
            isCorrect,
          },
        });

    return successResponse(progress, isCorrect ? 'Correct answer!' : 'Incorrect answer');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// GET /api/video-checkpoints/progress - Get student's checkpoint progress for a lesson
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['STUDENT', 'TEACHER', 'SCHOOL_ADMIN', 'PARENT']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    let studentId = searchParams.get('studentId');

    if (!lessonId) {
      return errorResponse('lessonId is required', 400);
    }

    // If student, override studentId to be their own profile ID
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      });
      studentId = student?.id || null;
    }

    if (!studentId) {
      return errorResponse('studentId is required', 400);
    }

    // Verify school isolation for studentId
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });

    if (!student) {
      return errorResponse('Student profile not found', 404);
    }

    if (auth.role !== 'SUPER_ADMIN' && student.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized to view progress for this student', 403);
    }

    // Get all checkpoints for the lesson
    const checkpoints = await db.videoCheckpoint.findMany({
      where: { lessonId },
      orderBy: { timestamp: 'asc' },
      select: { id: true },
    });

    const checkpointIds = checkpoints.map(c => c.id);

    // Get student's progress
    const progress = await db.videoCheckpointProgress.findMany({
      where: {
        studentId,
        checkpointId: { in: checkpointIds },
      },
    });

    // Calculate completion
    const answeredCount = progress.length;
    const correctCount = progress.filter(p => p.isCorrect).length;
    const totalCheckpoints = checkpoints.length;
    const completionRate = totalCheckpoints > 0 
      ? Math.round((answeredCount / totalCheckpoints) * 100) 
      : 0;
    const accuracyRate = answeredCount > 0 
      ? Math.round((correctCount / answeredCount) * 100) 
      : 0;

    return successResponse({
      totalCheckpoints,
      answeredCount,
      correctCount,
      completionRate,
      accuracyRate,
      progress: progress.map(p => ({
        checkpointId: p.checkpointId,
        answer: p.answer,
        isCorrect: p.isCorrect,
        answeredAt: p.answeredAt,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}