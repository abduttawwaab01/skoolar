import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireFeature } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? (body.schoolId || auth.schoolId) : auth.schoolId;

    const where: Record<string, unknown> = { id: { in: ids } };
    if (targetSchoolId) where.schoolId = targetSchoolId;

    const result = await db.questionBank.updateMany({
      where,
      data: { isActive: false },
    });

    return NextResponse.json({ message: `${result.count} question(s) deactivated`, count: result.count });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
