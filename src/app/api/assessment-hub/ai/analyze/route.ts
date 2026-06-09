import { NextRequest } from 'next/server';
import { apiHandler, successResponse, validateSchema } from '@/lib/api-helpers';
import { AIRecommendSchema } from '@/lib/validators/assessment';
import { analyzeProfile } from '@/lib/ai-assessment';
import { db } from '@/lib/db';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(AIRecommendSchema, body);
    if (!validation.valid) return validation.error;

    let profileData: Record<string, unknown> = {};

    if (validation.data.targetType === 'student') {
      const student = await db.student.findUnique({ where: { id: validation.data.profileId }, select: { user: { select: { name: true } } } });
      const [skillProfiles, results, growthRecords] = await Promise.all([
        db.studentSkillProfile.findMany({ where: { studentId: validation.data.profileId } }),
        db.studentDomainResult.findMany({ where: { studentId: validation.data.profileId }, orderBy: { createdAt: 'desc' }, take: 10 }),
        db.studentGrowthRecord.findMany({ where: { studentId: validation.data.profileId }, orderBy: { snapshotDate: 'asc' } }),
      ]);
      profileData = { studentName: student?.user.name, skillProfiles, results, growthRecords, targetType: 'student' };
    } else {
      const teacher = await db.teacher.findUnique({ where: { id: validation.data.profileId }, select: { user: { select: { name: true } } } });
      const [competencyProfiles, observations] = await Promise.all([
        db.teacherCompetencyProfile.findMany({ where: { teacherId: validation.data.profileId } }),
        db.teacherObservationRecord.findMany({ where: { teacherId: validation.data.profileId }, orderBy: { date: 'desc' }, take: 5 }),
      ]);
      profileData = { teacherName: teacher?.user.name, competencyProfiles, observations, targetType: 'teacher' };
    }

    const result = await analyzeProfile(profileData, validation.data.targetType, ctx.schoolId);
    if (!result.success) {
      return successResponse({ summary: 'Analysis unavailable' });
    }

    return successResponse(result.data, 'Profile analyzed');
  }, req);
