import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, endDate: customEndDate } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const payment = await db.platformPayment.findUnique({
      where: { id },
      include: { plan: true, school: { select: { id: true, name: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (payment.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      let endDate: Date;
      if (customEndDate) {
        endDate = new Date(customEndDate);
      } else if (payment.endDate) {
        endDate = payment.endDate;
      } else {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
      }

      await db.platformPayment.update({
        where: { id },
        data: {
          status: 'success',
          channel: 'bank_transfer_verified',
          verifiedAt: new Date(),
          ...(customEndDate ? { endDate } : {}),
        },
      });

      await db.platformPayment.updateMany({
        where: {
          schoolId: payment.schoolId,
          id: { not: payment.id },
          status: { in: ['active', 'success'] },
        },
        data: { status: 'expired' },
      });

      await db.school.update({
        where: { id: payment.schoolId },
        data: {
          planId: payment.planId,
          plan: payment.plan.name,
          schoolType: payment.schoolType || undefined,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Subscription approved for ${payment.school.name}. Plan: ${payment.plan.displayName}. Expires: ${endDate.toLocaleDateString()}`,
        data: { endDate },
      });
    } else {
      await db.platformPayment.update({
        where: { id },
        data: { status: 'failed' },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription request rejected.',
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
