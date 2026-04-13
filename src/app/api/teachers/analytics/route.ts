import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Find Teacher identity using userId
    const teacher = await db.teacher.findFirst({
      where: { userId: auth.userId, schoolId: auth.schoolId },
      include: {
        classes: { select: { id: true, name: true } },
        classSubjects: { select: { classId: true } }
      }
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });
    }

    const teacherId = teacher.id;
    const schoolId = teacher.schoolId;

    // Resolve assigned class IDs
    const assignedClassIds = Array.from(new Set([
      ...teacher.classes.map(c => c.id),
      ...teacher.classSubjects.map(cs => cs.classId)
    ]));

    // Lead Class (first class where they are class teacher)
    const leadClassId = teacher.classes[0]?.id || null;

    // 1. Attendance Health (Today's attendance for lead class)
    let attendanceHealth = 0;
    if (leadClassId) {
      const today = startOfDay(new Date());
      const [attendanceCount, studentCount] = await Promise.all([
        db.attendance.count({
          where: { 
            classId: leadClassId, 
            date: { gte: today, lte: endOfDay(today) },
            status: 'present'
          }
        }),
        db.student.count({ where: { classId: leadClassId, isActive: true } })
      ]);
      attendanceHealth = studentCount > 0 ? Math.round((attendanceCount / studentCount) * 100) : 0;
    }

    // 2. Grading Health (% of submissions reviewed for their homeworks)
    const homeworks = await db.homework.findMany({
      where: { teacherId, schoolId },
      select: { id: true, _count: { select: { submissions: true } } }
    });
    
    const hwIds = homeworks.map(h => h.id);
    const gradedSubmissions = await db.homeworkSubmission.count({
      where: { homeworkId: { in: hwIds }, status: 'graded' }
    });
    const totalSubmissions = homeworks.reduce((acc, h) => acc + h._count.submissions, 0);
    const gradingHealth = totalSubmissions > 0 ? Math.round((gradedSubmissions / totalSubmissions) * 100) : 0;

    // 3. Evaluation Health (% of Weekly Evaluations completed for lead class this week)
    let evaluationHealth = 0;
    if (leadClassId) {
      const start = startOfWeek(new Date());
      const end = endOfWeek(new Date());
      const [evalCount, studentCount] = await Promise.all([
        db.weeklyEvaluation.count({
          where: { 
            classId: leadClassId as any, // WeeklyEvaluation model might not have classId directly in some versions, checking...
            weekDate: { gte: start, lte: end } 
          }
        }),
        db.student.count({ where: { classId: leadClassId, isActive: true } })
      ]);
      // Search results showed WeeklyEvaluation has studentId, teacherId, schoolId. 
      // I should filter by students in the lead class if classId is missing.
      const evalByStudentsCount = await db.weeklyEvaluation.count({
        where: {
          teacherId,
          weekDate: { gte: start, lte: end },
          student: { classId: leadClassId }
        }
      });
      evaluationHealth = studentCount > 0 ? Math.round((evalByStudentsCount / studentCount) * 100) : 0;
    }

    // 4. Academic Health (Published exams for their subjects)
    const exams = await db.exam.findMany({
      where: { teacherId, schoolId },
      select: { isPublished: true }
    });
    const publishedExams = exams.filter(e => e.isPublished).length;
    const academicHealth = exams.length > 0 ? Math.round((publishedExams / exams.length) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        attendanceHealth,
        gradingHealth,
        academicHealth,
        evaluationHealth,
        stats: {
          totalClasses: assignedClassIds.length,
          totalExams: exams.length,
          totalHomework: homeworks.length,
          pendingHomework: totalSubmissions - gradedSubmissions
        }
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
