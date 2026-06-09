import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiHandler, errorResponse } from '@/lib/api-helpers';

export const GET = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  apiHandler(async (ctx) => {
    const { id } = await params;
    const results = await db.studentDomainResult.findFirst({
      where: { assessmentId: id },
      include: {
        assessment: { select: { name: true, type: true, sections: { select: { id: true, name: true, domain: true } } } },
      },
    });
    if (!results) return errorResponse('Results not found', 404);
    return results;
  }, req);
