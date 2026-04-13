import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Resolve student record
    const student = await db.student.findUnique({
      where: { userId: auth.userId },
      include: {
        class: { select: { id: true, name: true, section: true } }
      }
    });

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const schoolId = student.schoolId;
    const studentId = student.id;

    // 1. Attendance Rate
    const attendanceCount = await db.attendance.count({
      where: { studentId }
    });
    const presentCount = await db.attendance.count({
      where: { studentId, status: 'present' }
    });
    const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;

    // 2. Homework Stats
    const totalHomework = await db.homework.count({
      where: { classId: student.classId, deletedAt: null }
    });
    const submittedHomework = await db.homeworkSubmission.count({
      where: { studentId }
    });

    // 3. Behavior Score (Assume 100 as base, adjusted by behavior logs)
    const positiveLogs = await db.behaviorLog.aggregate({
      where: { studentId, type: 'positive' },
      _sum: { points: true }
    });
    const negativeLogs = await db.behaviorLog.aggregate({
      where: { studentId, type: 'negative' },
      _sum: { points: true }
    });
    
    // Points-based percentage calculation (Base 100, max 100, min 0)
    const netPoints = (positiveLogs._sum.points || 0) + (negativeLogs._sum.points || 0);
    const behaviorPercentage = Math.min(Math.max(100 + netPoints, 0), 100);

    // 4. Recent Activity (from AuditLog)
    const recentActivity = await db.auditLog.findMany({
      where: { 
        schoolId, 
        userId: student.id, // We logged studentId as userId in some cases, or it's about them
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Fallback search if userId didn't catch it (since audit logs might use entityId for student)
    let activities = recentActivity;
    if (activities.length === 0) {
      activities = await db.auditLog.findMany({
        where: {
          schoolId,
          OR: [
            { entityId: student.id },
            { details: { contains: student.id } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
    }

    // 5. Next Exam
    const nextExam = await db.exam.findFirst({
      where: { 
        schoolId, 
        classId: student.classId || undefined, 
        date: { gte: new Date() } 
      },
      include: { subject: { select: { name: true } } },
      orderBy: { date: 'asc' }
    });

    return NextResponse.json({
      data: {
        profile: {
          id: student.id,
          admissionNo: student.admissionNo,
          gpa: student.gpa,
          rank: student.rank,
          class: student.class
        },
        stats: {
          attendanceRate,
          homeworkCompletion: totalHomework > 0 ? Math.round((submittedHomework / totalHomework) * 100) : 0,
          homeworkPending: totalHomework - submittedHomework,
          behaviorScore: behaviorPercentage,
        },
        nextExam: nextExam ? {
          id: nextExam.id,
          name: nextExam.name,
          date: nextExam.date,
          subject: nextExam.subject?.name
        } : null,
        activities: activities.map(a => ({
          id: a.id,
          action: a.action,
          entity: a.entity,
          details: a.details,
          date: a.createdAt
        }))
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
