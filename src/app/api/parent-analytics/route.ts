import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';
    const termId = searchParams.get('termId');
    const classId = searchParams.get('classId');

    if (!studentId) {
      return errorResponse('studentId is required', 400);
    }

    // If parent, validate they can access this student
    if (auth.role === 'PARENT') {
      const parent = await db.parent.findFirst({
        where: { userId: auth.userId },
        include: {
          parentStudents: {
            where: { studentId },
          },
        },
      });

      if (!parent || parent.parentStudents.length === 0) {
        return errorResponse('You do not have access to this student', 403);
      }
    }

    // Get student with class info
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
        school: { select: { id: true, name: true } },
        user: { select: { name: true, avatar: true } },
      },
    });

    if (!student) {
      return errorResponse('Student not found', 404);
    }

    // School isolation: SCHOOL_ADMIN can only access students in their own school
    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'PARENT' && student.schoolId !== auth.schoolId) {
      return errorResponse('Unauthorized', 403);
    }

    const schoolId = student.schoolId;

    // Get current or specified term
    let currentTerm;
    if (termId) {
      currentTerm = await db.term.findUnique({
        where: { id: termId },
      });
    } else {
      currentTerm = await db.term.findFirst({
        where: { schoolId, isCurrent: true },
        orderBy: { order: 'desc' },
      });
    }

    // Get class students for ranking comparison
    const classStudents = await db.student.findMany({
      where: { classId: student.classId },
      select: {
        id: true,
        gpa: true,
        cumulativeGpa: true,
        rank: true,
        user: { select: { name: true } },
      },
      orderBy: { gpa: 'desc' },
    });

    // Calculate percentile
    const totalInClass = classStudents.length;
    const studentIndex = classStudents.findIndex(s => s.id === studentId);
    const percentile = totalInClass > 0 
      ? Math.round(((totalInClass - studentIndex) / totalInClass) * 100)
      : 0;

    // Get student's exam scores for subject comparison
    const examScores = await db.examScore.findMany({
      where: {
        studentId,
        exam: {
          schoolId,
          ...(currentTerm ? { termId: currentTerm.id } : {}),
        },
      },
      include: {
        exam: {
          include: {
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Group by subject
    const subjectScores: Record<string, { subjectName: string; scores: number[]; average: number }> = {};
    
    for (const score of examScores) {
      const subjectName = score.exam.subject.name;
      if (!subjectScores[subjectName]) {
        subjectScores[subjectName] = { subjectName, scores: [], average: 0 };
      }
      subjectScores[subjectName].scores.push(score.score);
    }

    // Calculate subject averages and compare with class
    const subjectAnalysis = await Promise.all(
      Object.values(subjectScores).map(async (subj) => {
        const avg = subj.scores.length > 0 
          ? subj.scores.reduce((a, b) => a + b, 0) / subj.scores.length 
          : 0;

        // Get class average for this subject
        const classExamScores = await db.examScore.findMany({
          where: {
            exam: {
              schoolId,
              subject: { name: subj.subjectName },
              ...(student.classId ? { classId: student.classId } : {}),
              ...(currentTerm ? { termId: currentTerm.id } : {}),
            },
          },
        });

        const classAvg = classExamScores.length > 0
          ? classExamScores.reduce((a, b) => a + b.score, 0) / classExamScores.length
          : 0;

        const difference = Math.round(avg - classAvg);
        const comparison = difference > 0 ? 'above' : difference < 0 ? 'below' : 'average';

        return {
          subjectName: subj.subjectName,
          studentAverage: Math.round(avg * 10) / 10,
          classAverage: Math.round(classAvg * 10) / 10,
          difference,
          comparison,
          examsTaken: subj.scores.length,
        };
      })
    );

    // Sort by difference (show biggest improvements first)
    subjectAnalysis.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    // Get attendance data
    const attendanceRecords = await db.attendance.findMany({
      where: {
        studentId,
        schoolId,
        ...(currentTerm ? { termId: currentTerm.id } : {}),
      },
    });

    const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
    const absentCount = attendanceRecords.filter(a => a.status === 'absent').length;
    const lateCount = attendanceRecords.filter(a => a.status === 'late').length;
    const totalDays = attendanceRecords.length;
    const attendanceRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

    // Get all terms for trend analysis
    const allTerms = await db.term.findMany({
      where: { schoolId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, isCurrent: true },
    });

    // Get GPA trend across terms
    const gpaTrend = await Promise.all(
      allTerms.slice(-4).map(async (term) => {
        const termScores = await db.examScore.findMany({
          where: {
            studentId,
            exam: { termId: term.id },
          },
          include: {
            exam: { select: { totalMarks: true } },
          },
        });

        if (termScores.length === 0) {
          return { termId: term.id, termName: term.name, gpa: null, average: null };
        }

        const totalScore = termScores.reduce((sum, s) => sum + s.score, 0);
        const totalMarks = termScores.reduce((sum, s) => sum + (s.exam?.totalMarks || 0), 0);
        const avg = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
        
        // GPA calculation (assuming 100-based, convert to 5.0 scale)
        const gpa = avg >= 90 ? 5.0 : avg >= 80 ? 4.0 : avg >= 70 ? 3.0 : avg >= 60 ? 2.0 : 1.0;

        return {
          termId: term.id,
          termName: term.name,
          gpa: Math.round(gpa * 10) / 10,
          average: Math.round(avg * 10) / 10,
        };
      })
    );

    // Get current GPA and rank
    const currentGPA = student.gpa || 0;
    const currentRank = student.rank;

    // Get behavior score
    const behaviorScore = student.behaviorScore || 100;

    // Get weekly evaluation data if available
    const weeklyEvals = await db.weeklyEvaluation.findMany({
      where: {
        studentId,
        ...(currentTerm ? { weekDate: { gte: currentTerm.startDate, lte: currentTerm.endDate } } : {}),
      },
      include: {
        teacher: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { weekDate: 'desc' },
      take: 8,
    });

    const evalTrend = weeklyEvals.length > 0
      ? {
          averageScore: Math.round(
            weeklyEvals.reduce((sum, e) => 
              sum + (e.academicPerformance + e.behavior + e.attendance + e.homework) / 4, 
              0
            ) / weeklyEvals.length * 10
          ) / 10,
          latestWeek: weeklyEvals[0]?.weekDate 
            ? new Date(weeklyEvals[0].weekDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null,
          trend: weeklyEvals.length >= 2 
            ? (weeklyEvals[0].academicPerformance > weeklyEvals[1].academicPerformance ? 'improving' : 
               weeklyEvals[0].academicPerformance < weeklyEvals[1].academicPerformance ? 'declining' : 'stable')
            : 'stable',
        }
      : null;

    // Get achievements
    const achievements = await db.achievement.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Calculate overall ranking information
    const rankingInfo = {
      classRank: currentRank,
      totalInClass: totalInClass,
      percentile,
      position: studentIndex + 1,
    };

    // Get level/department info if available
    const levelInfo = student.class?.grade || 'General';
    const sectionInfo = student.class?.section || null;

    return successResponse({
      student: {
        id: student.id,
        name: student.user.name,
        avatar: student.user.avatar,
        admissionNo: student.admissionNo,
        class: student.class?.name || 'Unassigned',
        level: levelInfo,
        section: sectionInfo,
        schoolName: student.school.name,
      },
      currentTerm: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
      academicPerformance: {
        gpa: currentGPA,
        cumulativeGpa: student.cumulativeGpa || 0,
        ranking: rankingInfo,
      },
      subjectAnalysis,
      attendance: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        total: totalDays,
        rate: attendanceRate,
      },
      gpaTrend,
      weeklyEvaluation: evalTrend,
      behaviorScore,
      achievements: achievements.map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
        date: a.date,
        badgeIcon: a.badgeIcon,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Parent analytics error:', message);
    return errorResponse(message, 500);
  }
}