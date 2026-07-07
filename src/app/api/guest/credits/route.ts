import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const CREDIT_PRICE_NAIRA = 500;

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

// POST /api/guest/credits — create a credit purchase request
export async function POST(request: NextRequest) {
  try {
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

    const amount = quantity * CREDIT_PRICE_NAIRA;
    const reference = `guest_credits_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create pending payment record
    const payment = await db.guestPayment.create({
      data: {
        guestUserId: guestId,
        amount: amount * 100,
        credits: quantity,
        reference,
        status: 'pending',
      },
    });

    return NextResponse.json({
      data: {
        reference,
        amount: amount * 100,
        paymentId: payment.id,
        message: 'Payment reference generated. Please contact support to complete payment.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
