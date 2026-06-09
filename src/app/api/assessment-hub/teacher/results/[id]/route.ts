import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, errorResponse } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const attempt = await db.teacherAssessmentAttempt.findFirst({
      where: { id, schoolId: ctx.schoolId, status: { in: ['submitted', 'graded'] } },
      include: { assessment: { select: { name: true, type: true } } },
    });
    if (!attempt) return errorResponse('Result not found', 404);

    const domainScores = attempt.domainScores ? JSON.parse(attempt.domainScores) : [];
    const overallScore = domainScores.length > 0
      ? Math.round(domainScores.reduce((sum: number, d: any) => sum + (d.score || 0), 0) / domainScores.length)
      : 0;
    const avgScore = overallScore;
    const masteryLevel = avgScore >= 80 ? 'EXPERT' : avgScore >= 60 ? 'PROFICIENT' : avgScore >= 40 ? 'DEVELOPING' : 'BEGINNER';

    return {
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      assessment: { title: attempt.assessment.name, type: attempt.assessment.type },
      domainResults: domainScores,
      overallScore,
      masteryLevel,
      completedAt: attempt.submittedAt,
    };
  }, req);
