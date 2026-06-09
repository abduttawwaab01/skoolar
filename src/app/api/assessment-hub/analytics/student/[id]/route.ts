import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const studentId = (await params).id;

    const [skillProfiles, growthRecords, results] = await Promise.all([
      db.studentSkillProfile.findMany({ where: { studentId } }),
      db.studentGrowthRecord.findMany({ where: { studentId }, orderBy: { snapshotDate: 'asc' } }),
      db.studentDomainResult.findMany({
        where: { studentId },
        include: { assessment: { select: { name: true, type: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const domainBreakdown = [...new Set(results.map(r => r.domain))].map(domain => {
      const domainResults = results.filter(r => r.domain === domain);
      const avgScore = domainResults.length > 0
        ? Math.round(domainResults.reduce((s, r) => s + r.percentage, 0) / domainResults.length)
        : 0;
      return { domain, averageScore: avgScore, totalAssessments: domainResults.length };
    });

    return {
      studentId,
      domainBreakdown,
      skillProfiles,
      growthTrend: growthRecords.length >= 2
        ? ((growthRecords[growthRecords.length - 1].overallScore ?? 0) - (growthRecords[0].overallScore ?? 0) > 5 ? 'improving' : 'stable')
        : 'stable',
      totalAssessmentsTaken: results.length,
      averageScore: results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0,
    };
  }, req);
