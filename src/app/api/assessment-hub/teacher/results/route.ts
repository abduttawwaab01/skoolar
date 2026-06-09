import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, getPaginationParams } from '@/lib/api-helpers';

export const GET = async (req: NextRequest) =>
  apiHandler(async (ctx) => {
    const { searchParams } = new URL(req.url);
    const { page, limit } = getPaginationParams(searchParams);
    const teacherId = searchParams.get('teacherId') || '';

    const where: Record<string, unknown> = { schoolId: ctx.schoolId, status: { in: ['submitted', 'graded'] } };
    if (teacherId) where.teacherId = teacherId;

    const [data, total] = await Promise.all([
      db.teacherAssessmentAttempt.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: { assessment: { select: { name: true, type: true } } },
      }),
      db.teacherAssessmentAttempt.count({ where: where as any }),
    ]);

    const results = data.map((attempt) => {
      const domainScores = attempt.domainScores ? JSON.parse(attempt.domainScores) : [];
      const overallScore = domainScores.length > 0
        ? Math.round(domainScores.reduce((sum: number, d: any) => sum + (d.score || 0), 0) / domainScores.length)
        : 0;
      const avgScore = overallScore;
      const masteryLevel = avgScore >= 80 ? 'EXPERT' : avgScore >= 60 ? 'PROFICIENT' : avgScore >= 40 ? 'DEVELOPING' : 'BEGINNER';

      return {
        id: attempt.id,
        assessmentId: attempt.assessmentId,
        teacherId: attempt.teacherId,
        assessment: { title: attempt.assessment.name, type: attempt.assessment.type },
        domainResults: domainScores,
        overallScore,
        masteryLevel,
        completedAt: attempt.submittedAt,
      };
    });

    return { data: results, total, page, totalPages: Math.ceil(total / limit) };
  }, req);
