import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, errorResponse } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const studentId = (await params).id;

    const [skillProfiles, learningStyle, recentResults, growthRecords] = await Promise.all([
      db.studentSkillProfile.findMany({ where: { studentId }, orderBy: [{ domain: 'asc' }, { masteryScore: 'desc' }] }),
      db.studentLearningStyleProfile.findUnique({ where: { studentId } }),
      db.studentDomainResult.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { assessment: { select: { name: true, type: true } } },
      }),
      db.studentGrowthRecord.findMany({
        where: { studentId },
        orderBy: { snapshotDate: 'asc' },
        take: 20,
      }),
    ]);

    const domains = [...new Set(skillProfiles.map(s => s.domain))];
    const domainSummaries = domains.map(domain => {
      const skills = skillProfiles.filter(s => s.domain === domain);
      const avgScore = skills.length > 0 ? Math.round(skills.reduce((s, p) => s + p.masteryScore, 0) / skills.length) : 0;
      return { domain, averageScore: avgScore, skills };
    });

    return {
      studentId,
      domainSummaries,
      learningStyle,
      recentResults,
      growthRecords,
      overallScore: growthRecords.length > 0 ? growthRecords[growthRecords.length - 1].overallScore : null,
    };
  }, req);
