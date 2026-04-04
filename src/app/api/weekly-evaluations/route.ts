import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

// GET /api/weekly-evaluations - Fetch evaluations
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || token.schoolId || '';
    const teacherId = searchParams.get('teacherId');
    const studentId = searchParams.get('studentId');
    const weekDate = searchParams.get('weekDate'); // Expect YYYY-MM-DD format
    const isShared = searchParams.get('isShared');
    
    // Super admin can see all, others limited by role
    let where: Record<string, unknown> = { schoolId };
    
    if (teacherId) where.teacherId = teacherId;
    if (studentId) where.studentId = studentId;
    if (weekDate) where.weekDate = new Date(weekDate);
    if (isShared !== null && isShared !== undefined) where.isShared = isShared === 'true';

    const evaluations = await db.weeklyEvaluation.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
        teacher: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { weekDate: 'desc' },
      take: 100,
    });

    // Add computed fields for display
    const enriched = evaluations.map(ev => ({
      ...ev,
      studentName: ev.student.user.name,
      studentClass: ev.student.class?.name || 'N/A',
      teacherName: ev.teacher.user.name,
      totalScore: (ev.academicPerformance + ev.behavior + ev.attendance + ev.homework + (ev.effort || 0)) / (ev.effort ? 5 : 4),
    }));

    return NextResponse.json({ data: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/weekly-evaluations - Create evaluation
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only teachers and admins can create evaluations
    const allowedRoles = ['TEACHER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR'];
    if (!allowedRoles.includes(token.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      studentId,
      weekDate,
      academicPerformance,
      behavior,
      attendance,
      homework,
      effort,
      comments,
      goals,
      strengths,
      areasToImprove,
      isShared,
    } = body;

    if (!studentId || !weekDate) {
      return NextResponse.json(
        { error: 'Student ID and week date are required' },
        { status: 400 }
      );
    }

    // Get teacher ID from token (for non-admins)
    let teacherId = token.id;
    
    // If admin or super admin, they must specify teacherId
    if (token.role === 'ADMIN' || token.role === 'SUPER_ADMIN') {
      if (!body.teacherId) {
        return NextResponse.json(
          { error: 'Teacher ID required for admin/super admin' },
          { status: 400 }
        );
      }
      teacherId = body.teacherId;
    } else {
      // For teachers, get their teacher profile
      const teacher = await db.teacher.findUnique({
        where: { userId: token.id },
        select: { id: true },
      });
      if (!teacher) {
        return NextResponse.json(
          { error: 'Teacher profile not found' },
          { status: 403 }
        );
      }
      teacherId = teacher.id;
    }

    // Validate ratings (1-5)
    const ratings = [academicPerformance, behavior, attendance, homework, effort].filter(r => r !== undefined);
    for (const rating of ratings) {
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: 'Ratings must be between 1 and 5' },
          { status: 400 }
        );
      }
    }

    // Check if evaluation already exists for this student/teacher/week
    const existing = await db.weeklyEvaluation.findFirst({
      where: {
        teacherId,
        studentId,
        weekDate: new Date(weekDate),
      },
    });

    let evaluation;
    if (existing) {
      // Update existing
      evaluation = await db.weeklyEvaluation.update({
        where: { id: existing.id },
        data: {
          academicPerformance: academicPerformance ?? existing.academicPerformance,
          behavior: behavior ?? existing.behavior,
          attendance: attendance ?? existing.attendance,
          homework: homework ?? existing.homework,
          effort: effort !== undefined ? effort : existing.effort,
          comments,
          goals,
          strengths,
          areasToImprove,
          isShared: isShared !== undefined ? isShared : existing.isShared,
        },
      });
    } else {
      // Create new
      const student = await db.student.findUnique({
        where: { id: studentId },
        select: { schoolId: true },
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      evaluation = await db.weeklyEvaluation.create({
        data: {
          schoolId: student.schoolId,
          teacherId,
          studentId,
          weekDate: new Date(weekDate),
          academicPerformance: academicPerformance ?? 3,
          behavior: behavior ?? 3,
          attendance: attendance ?? 3,
          homework: homework ?? 3,
          effort,
          comments,
          goals,
          strengths,
          areasToImprove,
          isShared: isShared ?? false,
        },
      });
    }

    // If shared, create notification for parent(s)
    if (isShared) {
      await shareEvaluationWithParents(evaluation.id);
    }

    return NextResponse.json(
      { success: true, data: evaluation, message: 'Evaluation saved' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper: Share evaluation with parents
async function shareEvaluationWithParents(evaluationId: string) {
  try {
    const evalData = await db.weeklyEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        student: {
          select: {
            userId: true,
            parentIds: true,
            user: { select: { name: true } },
          },
        },
        teacher: {
          select: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!evalData) return;

    // Parse parent IDs
    const parentIds = evalData.student.parentIds.split(',').filter(id => id.trim());
    
    // Create notifications for each parent
    for (const parentId of parentIds) {
      await db.notification.create({
        data: {
          userId: parentId,
          schoolId: evalData.schoolId,
          title: 'New Weekly Evaluation',
          message: `${evalData.teacher.user.name} has submitted a weekly evaluation for ${evalData.student.user?.name || 'your child'}.`,
          type: 'info',
          category: 'academic',
          actionUrl: `/parent-portal/evaluations/${evaluationId}`,
        },
      });
    }
  } catch (error) {
    console.error('Failed to share evaluation:', error);
  }
}