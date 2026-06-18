import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

// GET /api/teacher-performance - Get teacher performance data
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const termId = searchParams.get('termId');
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    // Get current term if not specified
    let currentTermId = termId;
    if (!currentTermId) {
      const currentTerm = await db.term.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      currentTermId = currentTerm?.id || null;
    }

    let where: Record<string, unknown> = { schoolId };

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (currentTermId) {
      where.termId = currentTermId;
    }

    const performances = await db.teacherPerformance.findMany({
      where,
      include: {
        teacher: {
          include: { user: { select: { name: true, avatar: true } } },
        },
        term: { select: { id: true, name: true } },
      },
      orderBy: { totalScore: 'desc' },
    });

    // Calculate rankings
    const rankedPerformances = performances.map((p, index) => ({
      ...p,
      rank: index + 1,
      teacherName: p.teacher.user.name,
      teacherAvatar: p.teacher.user.avatar,
    }));

    // If specific teacher requested, return their performance with rank
    if (teacherId && currentTermId) {
      const teacherPerf = rankedPerformances.find(p => p.teacherId === teacherId);
      if (teacherPerf) {
        return successResponse({
          ...teacherPerf,
          termName: teacherPerf.term?.name || 'Current Term',
        });
      }
    }

    return successResponse(rankedPerformances);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// POST /api/teacher-performance - Calculate/update performance for a term
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const { termId, teacherId } = body;

    if (!termId) {
      return errorResponse('termId is required', 400);
    }

    const schoolId = auth.schoolId || '';

    // Get term info
    const term = await db.term.findFirst({
      where: { id: termId, schoolId },
    });

    if (!term) {
      return errorResponse('Term not found', 404);
    }

    // Get all teachers in the school
    const teachers = await db.teacher.findMany({
      where: { schoolId, isActive: true },
      select: { id: true },
    });

    // If specific teacher, calculate only for them
    const targetTeachers = teacherId 
      ? teachers.filter(t => t.id === teacherId)
      : teachers;

    const results: any[] = [];

    for (const teacher of targetTeachers) {
      // 1. Calculate task completion score
      // Get tasks created during the term period
      const tasks = await db.teacherTask.findMany({
        where: {
          teacherId: teacher.id,
          createdAt: {
            gte: term.startDate,
            lte: term.endDate,
          },
        },
      });

      const completedTasks = tasks.filter(t => t.status === 'completed');
      const taskScore = tasks.length > 0 
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 100; // Default to 100 if no tasks

      // 2. Calculate punctuality score (from staff attendance)
      const attendanceLogs = await db.attendanceScanLog.findMany({
        where: {
          teacherId: teacher.id,
          createdAt: {
            gte: term.startDate,
            lte: term.endDate,
          },
        },
      });

      // Calculate on-time percentage based on expected arrival time (e.g., 8:00 AM)
      const punctualityScore = 85; // Placeholder - would need actual staff attendance system

      // 3. Class management score (based on class performance and behavior)
      const classStudents = await db.student.count({
        where: {
          class: { classTeacherId: teacher.id },
        },
      });

      const classScore = classStudents > 0 ? 80 : 50; // Placeholder

      // 4. Student feedback score (from student evaluations)
      // Simplified - would need actual student feedback system
      const studentFeedbackScore = 75; // Placeholder

      // 5. Weekly evaluation score (if applicable)
      // Get evaluations created during the term period
      const weeklyEvals = await db.weeklyEvaluation.findMany({
        where: {
          teacherId: teacher.id,
          weekDate: {
            gte: term.startDate,
            lte: term.endDate,
          },
        },
      });

      const weeklyEvalScore = weeklyEvals.length > 0
        ? Math.round(
            weeklyEvals.reduce((sum, e) => 
              sum + ((e.academicPerformance + e.behavior + e.attendance + e.homework) / 4), 
              0
            ) / weeklyEvals.length * 20
          )
        : 0;

      // Calculate total score (weighted)
      const totalScore = Math.round(
        taskScore * 0.25 +
        punctualityScore * 0.20 +
        classScore * 0.20 +
        studentFeedbackScore * 0.15 +
        weeklyEvalScore * 0.20
      );

      // Save or update performance record
      const existingPerf = await db.teacherPerformance.findUnique({
        where: {
          teacherId_termId: {
            teacherId: teacher.id,
            termId,
          },
        },
      });

      let performance;
      if (existingPerf) {
        performance = await db.teacherPerformance.update({
          where: { id: existingPerf.id },
          data: {
            taskCompletionScore: taskScore,
            punctualityScore,
            classScore,
            studentFeedbackScore,
            weeklyEvalScore,
            totalScore,
          },
        });
      } else {
        performance = await db.teacherPerformance.create({
          data: {
            schoolId,
            teacherId: teacher.id,
            termId,
            taskCompletionScore: taskScore,
            punctualityScore,
            classScore,
            studentFeedbackScore,
            weeklyEvalScore,
            totalScore,
          },
        });
      }

      results.push(performance as typeof results[number]);
    }

    // Calculate rankings
    const allPerformances = await db.teacherPerformance.findMany({
      where: { termId, schoolId },
      orderBy: { totalScore: 'desc' },
    });

    // Update ranks
    for (let i = 0; i < allPerformances.length; i++) {
      await db.teacherPerformance.update({
        where: { id: allPerformances[i].id },
        data: { rank: i + 1 },
      });
    }

    return successResponse({
      calculated: results.length,
      message: 'Performance calculated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}