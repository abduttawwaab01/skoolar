import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/teachers/[id]/stats - Get teacher performance statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth check
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Get teacher record
    const teacher = await db.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        school: { select: { id: true, name: true } },
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    // School context check
    const userSchoolId = auth.schoolId;
    if (userSchoolId && teacher.schoolId !== userSchoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get teacher's classes
    const classes = await db.class.findMany({
      where: { schoolId: teacher.schoolId, classTeacherId: id, deletedAt: null },
      select: { id: true, name: true, section: true },
    });

    // Get exams taught by this teacher
    const exams = await db.exam.findMany({
      where: { schoolId: teacher.schoolId, teacherId: id, deletedAt: null },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true, section: true } },
      },
    });

    // Calculate stats from exam scores
    let totalStudentsReached = 0;
    let totalExams = exams.length;
    let totalScoreSum = 0;
    let totalPossibleSum = 0;
    let passingCount = 0;
    let totalScoreCount = 0;

    for (const exam of exams) {
      const scores = await db.examScore.findMany({
        where: { examId: exam.id },
        select: { score: true },
      });

      if (scores.length > 0) {
        const scoreValues = scores.map(s => s.score);
        totalScoreSum += scoreValues.reduce((a, b) => a + b, 0);
        totalPossibleSum += scores.length * exam.totalMarks;
        passingCount += scoreValues.filter(s => s >= exam.passingMarks).length;
        totalScoreCount += scores.length;
      }
    }

    // Unique students (from classes + exam scores)
    const classStudentIds = new Set<string>();
    for (const cls of classes) {
      const students = await db.student.findMany({
        where: { classId: cls.id, deletedAt: null },
        select: { id: true },
      });
      students.forEach(s => classStudentIds.add(s.id));
    }

    // Also add students who took teacher's exams but might not be in teacher's classes
    for (const exam of exams) {
      const examStudentIds = await db.examScore.findMany({
        where: { examId: exam.id },
        select: { studentId: true },
      });
      examStudentIds.forEach(s => classStudentIds.add(s.studentId));
    }

    totalStudentsReached = classStudentIds.size;

    // Calculate metrics
    const averageScorePercent = totalPossibleSum > 0
      ? Math.round((totalScoreSum / totalPossibleSum) * 100)
      : 0;

    const passRate = totalScoreCount > 0
      ? Math.round((passingCount / totalScoreCount) * 100)
      : 0;

    // Homework grading stats (pending assignments)
    const homeworkCount = await db.homework.count({
      where: { schoolId: teacher.schoolId, teacherId: id, deletedAt: null },
    });

    const gradedSubmissions = await db.homeworkSubmission.count({
      where: {
        homework: { schoolId: teacher.schoolId, teacherId: id, deletedAt: null },
        status: 'graded',
      },
    });

    const pendingGrading = homeworkCount > 0 ? homeworkCount - gradedSubmissions : 0;

    return NextResponse.json({
      success: true,
      data: {
        teacherId: id,
        teacherName: teacher.user?.name,
        schoolName: teacher.school?.name,
        classes: classes.map(c => `${c.name}${c.section ? ' ' + c.section : ''}`),
        totalClasses: classes.length,
        totalStudents: totalStudentsReached,
        totalExams,
        averageScorePercent,
        passRate,
        homeworkCount,
        gradedSubmissions,
        pendingGrading,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
