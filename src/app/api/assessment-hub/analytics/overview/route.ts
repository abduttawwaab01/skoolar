import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-helpers';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const schoolId = ctx.schoolId;

    const [
      totalStudentAssessments,
      publishedStudentAssessments,
      totalTeacherAssessments,
      totalAttempts,
      gradedAttempts,
      studentCount,
      teacherCount,
      recentResults,
    ] = await Promise.all([
      db.studentAssessment.count({ where: { schoolId, deletedAt: null } }),
      db.studentAssessment.count({ where: { schoolId, status: 'published', deletedAt: null } }),
      db.teacherAssessment.count({ where: { schoolId, deletedAt: null } }),
      db.studentAssessmentAttempt.count({ where: { schoolId } }),
      db.studentAssessmentAttempt.count({ where: { schoolId, status: { in: ['submitted', 'graded'] } } }),
      db.student.count({ where: { schoolId, isActive: true } }),
      db.teacher.count({ where: { schoolId, isActive: true } }),
      db.studentDomainResult.findMany({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { student: { select: { user: { select: { name: true } }, classId: true } }, assessment: { select: { name: true } } },
      }),
    ]);

    const avgScore = await db.studentDomainResult.aggregate({ _avg: { percentage: true } });

    return {
      totalStudentAssessments,
      publishedStudentAssessments,
      totalTeacherAssessments,
      totalAttempts,
      completionRate: totalAttempts > 0 ? Math.round((gradedAttempts / totalAttempts) * 100) : 0,
      studentCount,
      teacherCount,
      averageScore: Math.round(avgScore._avg.percentage || 0),
      recentResults,
    };
  }, req);
