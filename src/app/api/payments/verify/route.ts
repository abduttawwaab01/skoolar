import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/payments/verify?reference=xxx - Verify payment status after Paystack redirect
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'reference is required' }, { status: 400 });
    }

    // Verify with Paystack API
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    let paystackVerified = false;

    if (PAYSTACK_SECRET_KEY) {
      try {
        const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });
        const data = await res.json();
        paystackVerified = data.status && data.data?.status === 'success';
      } catch {
        // Paystack API call failed
      }
    }

    // Find our payment record
    const payment = await db.platformPayment.findUnique({
      where: { reference },
      include: { plan: { select: { id: true, name: true, displayName: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // If Paystack says it's paid but our record is still pending, process it
    if (paystackVerified && payment.status === 'pending') {
      await db.platformPayment.update({
        where: { reference },
        data: { status: 'success', verifiedAt: new Date() },
      });

      // Deactivate old payments
      await db.platformPayment.updateMany({
        where: {
          schoolId: payment.schoolId,
          id: { not: payment.id },
          status: { in: ['active', 'success'] },
        },
        data: { status: 'expired' },
      });

      // Update school plan
      const planRecord = await db.subscriptionPlan.findUnique({
        where: { id: payment.planId },
        select: { name: true },
      });
      await db.school.update({
        where: { id: payment.schoolId },
        data: {
          planId: payment.planId,
          plan: planRecord?.name || payment.planId,
        },
      });
    }

    const isActive = payment.endDate ? new Date(payment.endDate) > new Date() : false;

    return NextResponse.json({
      data: {
        ...payment,
        paystackVerified,
        isActive,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
