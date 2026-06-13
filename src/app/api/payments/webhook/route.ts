import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// POST /api/payments/webhook - Paystack webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Verify Paystack signature - REQUIRED for security
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      console.error('[Webhook] PAYSTACK_SECRET_KEY is not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const paystackSignature = request.headers.get('x-paystack-signature');
    if (!paystackSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const hash = crypto
      .createHmac('sha512', paystackSecret)
      .update(body)
      .digest('hex');

    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle charge.success event
    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;

      // Find the payment record
      const payment = await db.platformPayment.findUnique({
        where: { reference },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
      }

      // If already processed, acknowledge
      if (payment.status === 'success') {
        return NextResponse.json({ received: true });
      }

      // Update payment status
      const updatedPayment = await db.platformPayment.update({
        where: { reference },
        data: {
          status: 'success',
          paystackRef: data.reference,
          channel: data.channel || null,
          verifiedAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        },
      });

      // Deactivate any other active/success payments for this school (same plan or not)
      await db.platformPayment.updateMany({
        where: {
          schoolId: payment.schoolId,
          id: { not: payment.id },
          status: { in: ['active', 'success'] },
        },
        data: { status: 'expired' },
      });

      // Update school plan — sync both planId and plan string
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

      console.log(`[Webhook] Payment ${reference} verified. School ${payment.schoolId} plan activated to "${planRecord?.name}".`);

      return NextResponse.json({ received: true, data: updatedPayment });
    }

    // Handle invoice.paid — recurring subscription renewal
    if (event.event === 'invoice.paid') {
      const data = event.data;
      const reference = `skoolar_invoice_${Date.now()}`;
      const meta = data.metadata || {};
      const schoolId = meta.schoolId;
      const planId = meta.planId;

      if (schoolId && planId) {
        const plan = await db.subscriptionPlan.findUnique({ where: { id: planId }, select: { name: true } });
        await db.platformPayment.create({
          data: {
            schoolId,
            planId,
            reference,
            amount: data.amount / 100,
            currency: 'NGN',
            status: 'success',
            paystackRef: data.reference,
            channel: data.channel || null,
            startDate: new Date(),
            endDate: new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()),
            verifiedAt: new Date(),
          },
        });
        await db.school.update({
          where: { id: schoolId },
          data: { planId, plan: plan?.name || planId },
        });
        console.log(`[Webhook] Invoice ${data.reference} paid. School ${schoolId} renewed.`);
      }
      return NextResponse.json({ received: true });
    }

    // Handle subscription.not_renew
    if (event.event === 'subscription.not_renew') {
      console.log(`[Webhook] Subscription not renewed:`, event.data?.subscription_code);
      return NextResponse.json({ received: true });
    }

    // Acknowledge other events
    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Error processing webhook:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
