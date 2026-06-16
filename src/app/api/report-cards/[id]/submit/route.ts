import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportCard = await db.reportCard.findUnique({ where: { id } });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (reportCard.approvalStatus !== 'draft') {
      return NextResponse.json({ error: `Cannot submit. Current status: ${reportCard.approvalStatus}` }, { status: 400 });
    }

    const body = await request.json();

    const [updated, approval] = await Promise.all([
      db.reportCard.update({ where: { id: id }, data: { approvalStatus: 'submitted', submittedAt: new Date(), version: { increment: 1 } } }),
      db.reportCardApproval.create({
        data: { reportCardId: id, action: 'submit', role: auth.role || '', userId: auth.userId || '', comment: body.comment || null },
      }),
    ]);

    return NextResponse.json({ data: updated, approval });
  } catch (error) {
    console.error('POST /api/report-cards/[id]/submit error:', error);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}
