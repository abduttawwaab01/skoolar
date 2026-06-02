import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

// GET /api/leaderboard - Get leaderboard data
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'DIRECTOR']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly'; // daily, weekly, termly, yearly
    const classId = searchParams.get('classId');
    const level = searchParams.get('level');
    const department = searchParams.get('department');
    const querySchoolId = searchParams.get('schoolId') || '';
    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return errorResponse('School context required', 403);
    }
    const period = searchParams.get('period'); // specific period

    // Determine period if not specified
    let currentPeriod: string;
    if (period) {
      currentPeriod = period;
    } else {
      const now = new Date();
      if (type === 'daily') {
        currentPeriod = now.toISOString().split('T')[0];
      } else if (type === 'weekly') {
        const weekNum = getWeekNumber(now);
        currentPeriod = `${now.getFullYear()}-week-${weekNum}`;
      } else if (type === 'termly') {
        const term = await db.term.findFirst({
          where: { schoolId: targetSchoolId, isCurrent: true },
          select: { id: true, name: true },
        });
        currentPeriod = term?.name || 'current-term';
      } else {
        currentPeriod = now.getFullYear().toString();
      }
    }

    // Try to get cached leaderboard first
    let leaderboard = await db.leaderboard.findFirst({
      where: {
        schoolId: targetSchoolId,
        type,
        classId: classId || null,
        level: level || null,
        department: department || null,
        period: currentPeriod,
      },
    });

    // If no cached leaderboard, calculate on the fly
    if (!leaderboard) {
      const leaderboardData = await calculateLeaderboard(targetSchoolId, type, classId, level, department, currentPeriod);

      // Save or update leaderboard
      const existing = await db.leaderboard.findFirst({
        where: {
          schoolId: targetSchoolId,
          type,
          classId: classId || null,
          level: level || null,
          department: department || null,
        },
      });

      if (existing) {
        leaderboard = await db.leaderboard.update({
          where: { id: existing.id },
          data: {
            period: currentPeriod,
            data: JSON.stringify(leaderboardData),
          },
        });
      } else {
        leaderboard = await db.leaderboard.create({
          data: {
            schoolId: targetSchoolId,
            type,
            classId: classId || null,
            level: level || null,
            department: department || null,
            period: currentPeriod,
            data: JSON.stringify(leaderboardData),
          },
        });
      }
    }

    const data = JSON.parse(leaderboard.data);

    // If student, return limited data (only their position)
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
      });

      if (student) {
        const studentRank = data.find((d: { studentId: string }) => d.studentId === student.id);
        
        if (studentRank) {
          // Return top 10 + student's own position
          const top10 = data.slice(0, 10);
          const studentData = data.find((d: { studentId: string }) => d.studentId === student.id);
          
          return successResponse({
            type,
            period: currentPeriod,
            top10,
            myPosition: studentData,
            totalStudents: data.length,
          });
        }
      }
    }

    // If parent, return their child's position + top 10
    if (auth.role === 'PARENT') {
      const parent = await db.parent.findFirst({
        where: { userId: auth.userId },
        include: {
          parentStudents: {
            include: { student: true },
          },
        },
      });

      if (parent && parent.parentStudents.length > 0) {
        const childIds = parent.parentStudents.map(ps => ps.studentId);
        const childPositions = data.filter((d: { studentId: string }) => childIds.includes(d.studentId));
        
        return successResponse({
          type,
          period: currentPeriod,
          top10: data.slice(0, 10),
          myChildren: childPositions,
          totalStudents: data.length,
        });
      }
    }

    // Teachers/Admins get full data
    return successResponse({
      type,
      period: currentPeriod,
      data,
      totalStudents: data.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}

// Helper function to calculate leaderboard
async function calculateLeaderboard(
  schoolId: string,
  type: string,
  classId?: string | null,
  level?: string | null,
  department?: string | null,
  period?: string
) {
  // Build student filter
  const studentWhere: Record<string, unknown> = { schoolId, isActive: true };
  if (classId) {
    studentWhere.classId = classId;
  }

  const students = await db.student.findMany({
    where: studentWhere,
    include: {
      user: { select: { name: true, avatar: true } },
      class: { select: { name: true, grade: true } },
    },
  });

  // Calculate scores for each student
  const studentScores = await Promise.all(
    students.map(async (student) => {
      let score = 0;
      let details: Record<string, number> = {};

      if (type === 'daily') {
        // Daily: Today's attendance + homework completion
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayAttendance = await db.attendance.findFirst({
          where: {
            studentId: student.id,
            date: { gte: today },
          },
        });

        details.attendance = todayAttendance?.status === 'present' ? 40 : 
                              todayAttendance?.status === 'late' ? 30 : 0;

        // Today's homework completion (simplified)
        const homeworkCompletion = 30; // Placeholder
        details.homework = homeworkCompletion;

        // Today's behavior score (simplified)
        const behaviorScore = student.behaviorScore || 100;
        details.behavior = Math.round((behaviorScore / 100) * 30);

        score = details.attendance + details.homework + details.behavior;
      } else if (type === 'weekly') {
        // Weekly: Average of daily scores + weekly evaluations
        const weekStart = getWeekStart(new Date());
        
        const weekAttendances = await db.attendance.findMany({
          where: {
            studentId: student.id,
            date: { gte: weekStart },
          },
        });

        const presentDays = weekAttendances.filter(a => a.status === 'present').length;
        const totalDays = weekAttendances.length;
        details.attendance = totalDays > 0 ? Math.round((presentDays / totalDays) * 40) : 30;

        // Weekly evaluation score (simplified)
        const recentEvals = await db.weeklyEvaluation.findMany({
          where: {
            studentId: student.id,
            weekDate: { gte: weekStart },
          },
        });

        if (recentEvals.length > 0) {
          const evalScore = recentEvals.reduce((sum, e) => 
            sum + (e.academicPerformance + e.behavior + e.attendance + e.homework) / 4, 0
          ) / recentEvals.length;
          details.evaluation = Math.round(evalScore * 4); // Scale to 40
        } else {
          details.evaluation = 20;
        }

        // GPA component
        details.gpa = Math.round((student.gpa || 0) * 8); // Scale to 20

        score = details.attendance + details.evaluation + details.gpa;
      } else if (type === 'termly') {
        // Termly: Full term performance
        const currentTerm = await db.term.findFirst({
          where: { schoolId, isCurrent: true },
        });

        if (currentTerm) {
          // Attendance
          const termAttendances = await db.attendance.findMany({
            where: {
              studentId: student.id,
              termId: currentTerm.id,
            },
          });

          const present = termAttendances.filter(a => a.status === 'present').length;
          const total = termAttendances.length;
          details.attendance = total > 0 ? Math.round((present / total) * 30) : 20;

          // GPA from exams
          details.gpa = Math.round((student.gpa || 0) * 14); // Scale to 70

          score = details.attendance + details.gpa;
        } else {
          score = Math.round((student.gpa || 0) * 100);
        }
      } else {
        // Yearly: Cumulative GPA
        score = Math.round((student.cumulativeGpa || student.gpa || 0) * 20);
      }

      return {
        studentId: student.id,
        studentName: student.user.name,
        avatar: student.user.avatar,
        className: student.class?.name || 'N/A',
        score,
        details,
      };
    })
  );

  // Sort by score descending
  studentScores.sort((a, b) => b.score - a.score);

  // Add rank
  return studentScores.map((s, index) => ({
    ...s,
    rank: index + 1,
  }));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// POST /api/leaderboard - Trigger leaderboard calculation (Admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthAndRole(request, ['SCHOOL_ADMIN', 'SUPER_ADMIN']);
    if (!authResult.valid) return authResult.error;
    const { auth } = authResult;

    const body = await request.json();
    const { type, classId, level, department } = body;

    const schoolId = auth.schoolId || '';
    
    // Calculate for all periods
    const periods = type === 'daily' 
      ? [new Date().toISOString().split('T')[0]]
      : type === 'weekly'
      ? [`${new Date().getFullYear()}-week-${getWeekNumber(new Date())}`]
      : type === 'termly'
      ? ['current-term']
      : [new Date().getFullYear().toString()];

    for (const period of periods) {
      const data = await calculateLeaderboard(schoolId, type, classId, level, department, period);

      // Save leaderboard
      await db.leaderboard.upsert({
        where: {
          schoolId_type_classId_level_department_period: {
            schoolId,
            type: type || 'weekly',
            classId: classId || '',
            level: level || '',
            department: department || '',
            period,
          },
        },
        create: {
          schoolId: schoolId as string,
          type: type || 'weekly',
          classId: classId || null,
          level: level || null,
          department: department || null,
          period,
          data: JSON.stringify(data),
        },
        update: {
          data: JSON.stringify(data),
        },
      });
    }

    return successResponse({ message: 'Leaderboard calculated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}