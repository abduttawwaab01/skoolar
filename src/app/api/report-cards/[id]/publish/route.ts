import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { canPublish } from '@/lib/report-card-utils/permissions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!canPublish(auth.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportCard = await db.reportCard.findUnique({ where: { id } });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (reportCard.approvalStatus !== 'approved' && reportCard.approvalStatus !== 'draft') {
      return NextResponse.json({ error: `Cannot publish. Current status: ${reportCard.approvalStatus}` }, { status: 400 });
    }

    const [updated, approval] = await Promise.all([
      db.reportCard.update({
        where: { id: id },
        data: { approvalStatus: 'published', isPublished: true, publishedAt: new Date() },
      }),
      db.reportCardApproval.create({
        data: { reportCardId: id, action: 'publish', role: auth.role || '', userId: auth.userId || '' },
      }),
    ]);

    return NextResponse.json({ data: updated, approval });
  } catch (error) {
    console.error('POST /api/report-cards/[id]/publish error:', error);
    return NextResponse.json({ error: 'Publish failed' }, { status: 500 });
  }
}
