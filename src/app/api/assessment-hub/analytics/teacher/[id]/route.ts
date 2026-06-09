import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const teacherId = (await params).id;

    const [profiles, observations, feedbackCount, attempts] = await Promise.all([
      db.teacherCompetencyProfile.findMany({ where: { teacherId } }),
      db.teacherObservationRecord.findMany({ where: { teacherId }, orderBy: { date: 'desc' } }),
      db.teacher360FeedbackEntry.count({ where: { teacherId, schoolId: ctx.schoolId, approvalStatus: 'approved' } }),
      db.teacherAssessmentAttempt.count({ where: { teacherId, status: 'submitted' } }),
    ]);

    const domainBreakdown = [...new Set(profiles.map(p => p.domain))].map(domain => {
      const domainProfiles = profiles.filter(p => p.domain === domain);
      return {
        domain,
        averageScore: domainProfiles.length > 0 ? Math.round(domainProfiles.reduce((s, p) => s + p.score, 0) / domainProfiles.length) : 0,
        competencyCount: domainProfiles.length,
      };
    });

    return {
      teacherId,
      domainBreakdown,
      totalObservations: observations.length,
      totalFeedbackEntries: feedbackCount,
      totalAssessmentsCompleted: attempts,
      averageObservationScore: observations.length > 0
        ? Math.round(observations.filter(o => o.overallScore).reduce((s, o) => s + (o.overallScore ?? 0), 0) / observations.filter(o => o.overallScore).length)
        : null,
    };
  }, req);
