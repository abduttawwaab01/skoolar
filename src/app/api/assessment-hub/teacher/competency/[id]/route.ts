import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const teacherId = (await params).id;
    const [profiles, observations, recentFeedbacks] = await Promise.all([
      db.teacherCompetencyProfile.findMany({
        where: { teacherId },
        orderBy: [{ domain: 'asc' }, { score: 'desc' }],
      }),
      db.teacherObservationRecord.findMany({
        where: { teacherId },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      db.teacher360FeedbackEntry.findMany({
        where: { teacherId, schoolId: ctx.schoolId, approvalStatus: 'approved' },
        orderBy: { submittedAt: 'desc' },
        take: 20,
      }),
    ]);

    const domains = [...new Set(profiles.map(p => p.domain))];
    const domainSummaries = domains.map(domain => {
      const items = profiles.filter(p => p.domain === domain);
      const avgScore = items.length > 0 ? Math.round(items.reduce((s, p) => s + p.score, 0) / items.length) : 0;
      return { domain, averageScore: avgScore, competencies: items };
    });

    return { teacherId, domainSummaries, observations, recentFeedbacks: recentFeedbacks.length };
  }, req);
