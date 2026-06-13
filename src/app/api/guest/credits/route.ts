import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const CREDIT_PRICE_KOBO = 50000; // ₦500 per credit
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

// POST /api/guest/credits — initialize Paystack credit purchase
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
    const amountKobo = amount * 100;
    const reference = `guest_credits_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create pending payment record
    const payment = await db.guestPayment.create({
      data: {
        guestUserId: guestId,
        amount: amountKobo,
        credits: quantity,
        reference,
        status: 'pending',
      },
    });

    // Initialize Paystack transaction
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

    if (PAYSTACK_SECRET_KEY) {
      try {
        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: amountKobo,
            reference,
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/live/create?guestId=${encodeURIComponent(guestId)}&credits_purchased=true`,
            metadata: {
              guestId,
              type: 'guest_credits',
              credits: quantity,
            },
          }),
        });

        const paystackData = await paystackRes.json();

        if (paystackData.status && paystackData.data) {
          return NextResponse.json({
            data: {
              authorizationUrl: paystackData.data.authorization_url,
              reference,
              publicKey: PAYSTACK_PUBLIC_KEY,
              paymentId: payment.id,
            },
          });
        }
      } catch {
        // Fall through to direct reference
      }
    }

    // Return reference for manual verification if Paystack fails
    return NextResponse.json({
      data: {
        reference,
        amount: amountKobo,
        paymentId: payment.id,
        message: 'Payment reference generated. Complete payment and verify.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
