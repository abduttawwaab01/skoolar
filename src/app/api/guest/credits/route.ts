import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const CREDIT_PRICE_NAIRA = 500;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// GET /api/guest/credits?guestId=xxx — get credit balance
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');

  if (!guestId) {
    return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
  }

  const guest = await db.guestUser.findUnique({
    where: { id: guestId },
    select: { id: true, email: true, credits: true, emailVerified: true },
  });

  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: guest.id,
      email: guest.email,
      credits: guest.credits,
      emailVerified: guest.emailVerified,
      pricePerCredit: CREDIT_PRICE_NAIRA,
    },
  });
}

// POST /api/guest/credits — initialize a Paystack payment for credits
export async function POST(request: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Payment provider is not configured. Please contact support.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { guestId, email, quantity = 1 } = body;

    if (!guestId || !email) {
      return NextResponse.json({ error: 'guestId and email are required' }, { status: 400 });
    }

    const guest = await db.guestUser.findUnique({ where: { id: guestId } });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.emailVerified) {
      return NextResponse.json({ error: 'Email not verified. Please verify your email first.' }, { status: 403 });
    }

    const credits = Math.max(1, Math.min(parseInt(quantity, 10) || 1, 100));
    const amountNaira = credits * CREDIT_PRICE_NAIRA;
    const reference = `guest_credits_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${origin}/live/create?guestId=${encodeURIComponent(guestId)}&credits_purchased=true`;

    const payment = await db.guestPayment.create({
      data: {
        guestUserId: guestId,
        amount: amountNaira * 100,
        credits,
        reference,
        status: 'pending',
      },
    });

    const paystackRes = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: guest.email,
        amount: amountNaira * 100,
        reference,
        callback_url: callbackUrl,
        metadata: { guestId, credits },
      }),
    });

    const paystackJson = await paystackRes.json().catch(() => null);

    if (!paystackRes.ok || !paystackJson?.status || !paystackJson?.data?.authorization_url) {
      await db.guestPayment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      return NextResponse.json(
        { error: 'Unable to initialize payment. Please try again later.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      data: {
        reference,
        authorizationUrl: paystackJson.data.authorization_url,
        amount: amountNaira * 100,
        paymentId: payment.id,
        message: 'Redirecting to payment...',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
