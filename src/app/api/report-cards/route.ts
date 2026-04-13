import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/report-cards - List report cards with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const studentId = searchParams.get('studentId') || '';
    const isPublished = searchParams.get('isPublished');

    const where: Record<string, unknown> = {};
    where.deletedAt = null;

    // School context validation
    const userSchoolId = auth.schoolId;
    if (userSchoolId) {
      where.schoolId = userSchoolId;
    } else if (schoolId) {
      where.schoolId = schoolId;
    }

    if (termId) where.termId = termId;
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (isPublished !== null && isPublished !== undefined && isPublished !== '') {
      where.isPublished = isPublished === 'true';
    }

    const [data, total] = await Promise.all([
      db.reportCard.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          schoolId: true,
          studentId: true,
          termId: true,
          classId: true,
          totalScore: true,
          averageScore: true,
          gpa: true,
          classRank: true,
          grade: true,
          teacherComment: true,
          principalComment: true,
          attendanceSummary: true,
          behaviorRating: true,
          isPublished: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { name: true, email: true, avatar: true } },
            },
          },
          term: {
            select: { id: true, name: true },
          },
          school: {
            select: { id: true, name: true, logo: true, motto: true },
          },
        },
      }),
      db.reportCard.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/report-cards - Generate report card
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const { schoolId, studentId, termId, classId, teacherComment, principalComment, behaviorRating } = body;

    // School context: use auth's schoolId if user is not SUPER_ADMIN
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!studentId || !termId || !classId) {
      return NextResponse.json(
        { error: 'studentId, termId, and classId are required' },
        { status: 400 }
      );
    }

    // Verify student exists and belongs to the school
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId: targetSchoolId },
      include: {
        user: { select: { name: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get all exam scores for this student, term, and class
    const examScores = await db.examScore.findMany({
      where: {
        studentId,
        exam: {
          termId,
          classId,
          schoolId: targetSchoolId,
        },
      },
      include: {
        exam: {
          select: {
            totalMarks: true,
            passingMarks: true,
            subject: { select: { name: true } },
          },
        },
      },
    });

    // Calculate totals
    const totalScore = examScores.reduce((sum, s) => s.score, 0);
    const totalMarks = examScores.reduce((sum, s) => s.exam.totalMarks, 0);
    const averageScore = examScores.length > 0
      ? Math.round((totalScore / examScores.length) * 100) / 100
      : 0;
    const overallPercentage = totalMarks > 0
      ? Math.round((totalScore / totalMarks) * 10000) / 100
      : 0;

    // Calculate GPA
    const gradePoints: Record<string, number> = {
      'A+': 4.0, 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0,
    };
    const totalGradePoints = examScores.reduce((sum, s) => sum + (gradePoints[s.grade || 'F'] || 0), 0);
    const gpa = examScores.length > 0
      ? Math.round((totalGradePoints / examScores.length) * 100) / 100
      : 0;

    // Calculate overall grade
    let grade = 'F';
    if (overallPercentage >= 90) grade = 'A+';
    else if (overallPercentage >= 80) grade = 'A';
    else if (overallPercentage >= 70) grade = 'B';
    else if (overallPercentage >= 60) grade = 'C';
    else if (overallPercentage >= 50) grade = 'D';

    // Optimize: Calculate class rank using a single query with aggregation instead of N+1
    const classScores = await db.examScore.groupBy({
      by: ['studentId'],
      where: {
        exam: { termId, classId, schoolId: targetSchoolId },
      },
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
    });

    const classRank = classScores.findIndex((s) => s.studentId === studentId) + 1;

    // Get attendance summary for this term
    const termRecord = await db.term.findUnique({ where: { id: termId } });
    const attendanceWhere: Record<string, unknown> = {
      studentId,
      classId,
    };
    if (termRecord) {
      attendanceWhere.date = {
        gte: termRecord.startDate,
        lte: termRecord.endDate,
      };
    }

    const attendanceRecords = await db.attendance.findMany({
      where: attendanceWhere,
      select: { status: true },
    });

    const attendanceSummary = JSON.stringify({
      total: attendanceRecords.length,
      present: attendanceRecords.filter((a) => a.status === 'present').length,
      absent: attendanceRecords.filter((a) => a.status === 'absent').length,
      late: attendanceRecords.filter((a) => a.status === 'late').length,
      percentage: attendanceRecords.length > 0
        ? Math.round((attendanceRecords.filter((a) => a.status === 'present').length / attendanceRecords.length) * 100)
        : 0,
    });

    // Upsert report card (unique on schoolId + studentId + termId)
    const reportCard = await db.reportCard.upsert({
      where: {
        schoolId_studentId_termId: {
          schoolId: targetSchoolId,
          studentId,
          termId,
        },
      },
      update: {
        classId,
        totalScore,
        averageScore,
        gpa,
        classRank: classRank > 0 ? classRank : null,
        grade,
        teacherComment: teacherComment || null,
        principalComment: principalComment || null,
        attendanceSummary,
        behaviorRating: behaviorRating || null,
      },
      create: {
        schoolId: targetSchoolId,
        studentId,
        termId,
        classId,
        totalScore,
        averageScore,
        gpa,
        classRank: classRank > 0 ? classRank : null,
        grade,
        teacherComment: teacherComment || null,
        principalComment: principalComment || null,
        attendanceSummary,
        behaviorRating: behaviorRating || null,
      },
    });

    return NextResponse.json(
      { data: reportCard, message: 'Report card generated successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
