import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/api-helpers';
import { generateReport } from '@/lib/ai-assessment';
import { db } from '@/lib/db';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const { assessmentId, studentId, teacherId, type } = body;

    let reportData: Record<string, unknown> = {};

    if (studentId) {
      const [results, skillProfiles, growth] = await Promise.all([
        db.studentDomainResult.findMany({
          where: { studentId, assessmentId: assessmentId || undefined },
        }),
        db.studentSkillProfile.findMany({ where: { studentId } }),
        db.studentGrowthRecord.findMany({ where: { studentId }, orderBy: { snapshotDate: 'asc' } }),
      ]);
      reportData = { results, skillProfiles, growth, studentId, type: 'individual' };
    } else if (teacherId) {
      const [competencyProfiles, observations] = await Promise.all([
        db.teacherCompetencyProfile.findMany({ where: { teacherId } }),
        db.teacherObservationRecord.findMany({ where: { teacherId } }),
      ]);
      reportData = { competencyProfiles, observations, teacherId, type: 'teacher' };
    }

    const result = await generateReport(reportData, type || 'individual', ctx.schoolId);
    if (!result.success) {
      return successResponse({ executiveSummary: 'Report generation unavailable' });
    }

    await db.assessmentReport.create({
      data: {
        schoolId: ctx.schoolId,
        type: type || 'individual',
        targetStudentId: studentId || null,
        targetTeacherId: teacherId || null,
        assessmentId: assessmentId || null,
        reportData: JSON.stringify(result.data),
      },
    });

    return successResponse(result.data, 'Report generated');
  }, req);
