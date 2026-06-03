import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthAndRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId') || '';

    if (!lessonId) return errorResponse('lessonId is required', 400);

    const lesson = await db.videoLesson.findUnique({
      where: { id: lessonId },
      select: { id: true, title: true, schoolId: true, subjectId: true, classId: true },
    });

    if (!lesson) return errorResponse('Lesson not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && lesson.schoolId !== auth.schoolId) return errorResponse('Access denied', 403);

    const checkpoints = await db.videoCheckpoint.findMany({
      where: { lessonId },
      orderBy: { timestamp: 'asc' },
      include: {
        progress: {
          include: { student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } } },
        },
      },
    });

    const totalStudents = new Set(checkpoints.flatMap(c => c.progress.map(p => p.studentId))).size;

    // Per-checkpoint analysis
    const perCheckpoint = checkpoints.map(cp => {
      const total = cp.progress.length;
      const correct = cp.progress.filter(p => p.isCorrect).length;
      const wrong = total - correct;
      return {
        checkpointId: cp.id, question: cp.question, questionType: cp.questionType, timestamp: cp.timestamp,
        correctAnswer: cp.correctAnswer, isRequired: cp.isRequired, order: cp.order,
        totalAnswers: total, correctCount: correct, wrongCount: wrong,
        correctRate: total > 0 ? Math.round((correct / total) * 10000) / 100 : 0,
        answerDistribution: Object.entries(
          cp.progress.reduce((acc: Record<string, number>, p) => {
            const ans = p.answer || '(blank)';
            acc[ans] = (acc[ans] || 0) + 1;
            return acc;
          }, {})
        ).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10),
      };
    });

    // Per-student analysis
    const perStudent: Record<string, any> = {};
    checkpoints.forEach(cp => {
      cp.progress.forEach(p => {
        if (!perStudent[p.studentId]) {
          perStudent[p.studentId] = {
            studentId: p.studentId, studentName: p.student.user.name, admissionNo: p.student.admissionNo,
            totalCheckpoints: 0, correctCount: 0, wrongCount: 0, details: [],
          };
        }
        perStudent[p.studentId].totalCheckpoints++;
        if (p.isCorrect) perStudent[p.studentId].correctCount++;
        else perStudent[p.studentId].wrongCount++;
        perStudent[p.studentId].details.push({
          checkpointId: cp.id, question: cp.question, timestamp: cp.timestamp,
          answer: p.answer, isCorrect: p.isCorrect, timeSpent: p.timeSpent,
        });
      });
    });

    const studentPerformance = Object.values(perStudent).map((s: any) => ({
      ...s,
      correctRate: s.totalCheckpoints > 0 ? Math.round((s.correctCount / s.totalCheckpoints) * 10000) / 100 : 0,
    }));

    // Aggregate
    const totalCheckpoints = checkpoints.length;
    const allCorrect = perCheckpoint.reduce((s, c) => s + c.correctCount, 0);
    const allTotal = perCheckpoint.reduce((s, c) => s + c.totalAnswers, 0);
    const overallCorrectRate = allTotal > 0 ? Math.round((allCorrect / allTotal) * 10000) / 100 : 0;

    return successResponse({
      lesson: { id: lesson.id, title: lesson.title },
      overview: {
        totalCheckpoints, totalStudents, totalAnswers: allTotal, correctAnswers: allCorrect,
        overallCorrectRate, averagePerStudent: studentPerformance.length > 0
          ? Math.round(studentPerformance.reduce((s: number, p: any) => s + p.correctRate, 0) / studentPerformance.length * 100) / 100 : 0,
      },
      perCheckpointAnalytics: perCheckpoint,
      perStudentPerformance: studentPerformance.sort((a: any, b: any) => b.correctRate - a.correctRate),
    });
  } catch (error: unknown) {
    console.error('[GET /api/video-checkpoints/analytics]', error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
