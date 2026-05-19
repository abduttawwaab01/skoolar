import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// PUT /api/payments/[id]/verify - Verify or reject a payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, comment } = body; // action: 'verify' | 'reject'

    if (!action || !['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "verify" or "reject"' }, { status: 400 });
    }

    const payment = await db.payment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && payment.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (payment.status !== 'pending_verification') {
      return NextResponse.json({ error: 'Payment is not pending verification' }, { status: 400 });
    }

    const newStatus = action === 'verify' ? 'verified' : 'failed';

    const updated = await db.payment.update({
      where: { id },
      data: {
        status: newStatus,
        verifiedBy: auth.userId,
        ...(newStatus === 'verified' ? { receiptNo: payment.receiptNo || `REC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}` } : {}),
      },
    });

    // Notify parent of verification result
    try {
      const student = await db.student.findUnique({
        where: { id: payment.studentId },
        select: { userId: true },
      });
      if (student) {
        const parentRecord = await db.parent.findFirst({
          where: { schoolId: payment.schoolId },
          include: {
            parentStudents: {
              where: { studentId: payment.studentId },
              select: { parentId: true },
            },
          },
        });
        if (parentRecord) {
          const parentUser = await db.parent.findUnique({
            where: { id: parentRecord.id },
            select: { userId: true },
          });
          if (parentUser) {
            const title = newStatus === 'verified' ? 'Payment Verified' : 'Payment Not Verified';
            const message = newStatus === 'verified'
              ? `Your payment of ₦${payment.amount.toLocaleString()} has been confirmed.`
              : `Your payment of ₦${payment.amount.toLocaleString()} could not be verified. ${comment ? `Reason: ${comment}` : 'Please contact the school.'}`;
            await db.notification.create({
              data: {
                userId: parentUser.userId,
                schoolId: payment.schoolId,
                title,
                message,
                type: newStatus === 'verified' ? 'success' : 'error',
                category: 'payment',
                actionUrl: '/dashboard?tab=finance',
              },
            });
          }
        }
      }
    } catch { /* silent */ }

    return NextResponse.json({ data: updated, message: `Payment ${newStatus} successfully` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
