import { NextRequest } from 'next/server';
import { apiHandler, successResponse, errorResponse, validateSchema } from '@/lib/api-helpers';
import { AIRecommendSchema } from '@/lib/validators/assessment';
import { generateRecommendations } from '@/lib/ai-assessment';
import { db } from '@/lib/db';

export const POST = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const body = await req.json();
    const validation = validateSchema(AIRecommendSchema, body);
    if (!validation.valid) return validation.error;

    let profileData: Record<string, unknown> = {};

    if (validation.data.targetType === 'student') {
      const [skillProfiles, results] = await Promise.all([
        db.studentSkillProfile.findMany({ where: { studentId: validation.data.profileId } }),
        db.studentDomainResult.findMany({
          where: { studentId: validation.data.profileId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);
      profileData = { skillProfiles, recentResults: results, targetType: 'student' };
    } else {
      const [competencyProfiles, observations] = await Promise.all([
        db.teacherCompetencyProfile.findMany({ where: { teacherId: validation.data.profileId } }),
        db.teacherObservationRecord.findMany({
          where: { teacherId: validation.data.profileId },
          orderBy: { date: 'desc' },
          take: 3,
        }),
      ]);
      profileData = { competencyProfiles, recentObservations: observations, targetType: 'teacher' };
    }

    const result = await generateRecommendations(profileData, validation.data.targetType, ctx.schoolId);

    if (!result.success) {
      return successResponse({ recommendations: [], warning: 'AI unavailable' });
    }

    const recs = (result.data as { recommendations?: Array<{ type: string; title: string; description: string; priority: string }> })?.recommendations || [];
    for (const rec of recs) {
      if (validation.data.targetType === 'student') {
        await db.studentRecommendation.create({
          data: {
            studentId: validation.data.profileId,
            schoolId: ctx.schoolId,
            domain: 'GENERAL',
            recommendationType: rec.type,
            title: rec.title,
            description: rec.description,
            priority: rec.priority,
            aiGenerated: true,
          },
        });
      } else {
        await db.teacherDevelopmentRecommendation.create({
          data: {
            teacherId: validation.data.profileId,
            schoolId: ctx.schoolId,
            domain: 'GENERAL',
            recommendationType: rec.type,
            title: rec.title,
            description: rec.description,
            priority: rec.priority,
            aiGenerated: true,
          },
        });
      }
    }

    return successResponse(result.data, 'Recommendations generated');
  }, req);
