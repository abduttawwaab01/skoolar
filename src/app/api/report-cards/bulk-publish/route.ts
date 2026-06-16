import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { canPublish } from '@/lib/report-card-utils/permissions';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!canPublish(auth.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { ids, filters } = body;

    if ((!ids || !ids.length) && !filters) {
      return NextResponse.json({ error: 'Provide ids array or filters object' }, { status: 400 });
    }

    let where: any = {};
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId) {
      where.schoolId = auth.schoolId;
    } else if (filters?.schoolId) {
      where.schoolId = filters.schoolId;
    }

    if (ids && ids.length) {
      where.id = { in: ids };
    } else if (filters) {
      if (filters.termId) where.termId = filters.termId;
      if (filters.classId) where.classId = filters.classId;
      if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;
      if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
    }

    const eligible = await db.reportCard.findMany({
      where: { ...where, approvalStatus: { in: ['approved', 'draft'] } },
      select: { id: true },
    });

    if (!eligible.length) {
      return NextResponse.json({ error: 'No eligible report cards found' }, { status: 404 });
    }

    const publishIds = eligible.map(r => r.id);

    await Promise.all([
      db.reportCard.updateMany({
        where: { id: { in: publishIds } },
        data: { approvalStatus: 'published', isPublished: true, publishedAt: new Date() },
      }),
      db.reportCardApproval.createMany({
        data: publishIds.map(reportCardId => ({
          reportCardId, action: 'publish', role: auth.role || '', userId: auth.userId || '',
        })),
      }),
    ]);

    return NextResponse.json({ message: `Published ${publishIds.length} report card(s)`, count: publishIds.length });
  } catch (error) {
    console.error('POST /api/report-cards/bulk-publish error:', error);
    return NextResponse.json({ error: 'Bulk publish failed' }, { status: 500 });
  }
}
