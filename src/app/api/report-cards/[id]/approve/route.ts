import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { canApprove } from '@/lib/report-card-utils/permissions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!canApprove(auth.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportCard = await db.reportCard.findUnique({ where: { id } });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (reportCard.approvalStatus !== 'submitted') {
      return NextResponse.json({ error: `Cannot approve. Current status: ${reportCard.approvalStatus}` }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action || 'approve'; // 'approve' | 'reject'

    const newStatus = action === 'approve' ? 'approved' : 'draft';

    const [updated, approval] = await Promise.all([
      db.reportCard.update({
        where: { id: id },
        data: { approvalStatus: newStatus, approvedAt: action === 'approve' ? new Date() : null },
      }),
      db.reportCardApproval.create({
        data: { reportCardId: id, action, role: auth.role || '', userId: auth.userId || '', comment: body.comment || null },
      }),
    ]);

    return NextResponse.json({ data: updated, approval });
  } catch (error) {
    console.error('POST /api/report-cards/[id]/approve error:', error);
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 });
  }
}
