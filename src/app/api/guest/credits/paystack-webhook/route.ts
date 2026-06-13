import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 });
    }

    const payload = await request.text();
    const paystackSignature = request.headers.get('x-paystack-signature');

    if (!paystackSignature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const hash = crypto
      .createHmac('sha512', paystackSecret)
      .update(payload)
      .digest('hex');

    if (hash !== paystackSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(payload);

    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;
      const metadata = data.metadata || {};

      if (metadata.type === 'guest_credits') {
        const payment = await db.guestPayment.findUnique({
          where: { reference },
          include: { guestUser: true },
        });

        if (payment && payment.status === 'pending') {
          // Update payment status
          await db.guestPayment.update({
            where: { id: payment.id },
            data: { status: 'success' },
          });

          // Credit the guest's account
          await db.guestUser.update({
            where: { id: payment.guestUserId },
            data: { credits: { increment: payment.credits } },
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[GuestCreditsWebhook] Error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
