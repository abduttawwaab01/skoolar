import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// POST /api/guest/payments/callback — Paystack webhook / server-to-server confirmation
export async function POST(request: NextRequest) {
  if (!PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  // Verify the webhook signature when Paystack provides one.
  if (signature) {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: { data?: { reference?: string }; reference?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const reference = body?.data?.reference || body?.reference;
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 });
  }

  const verifyRes = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
  );
  const verifyJson = await verifyRes.json().catch(() => null);

  if (!verifyRes.ok || !verifyJson?.status || verifyJson?.data?.status !== 'success') {
    return NextResponse.json({ status: 'ignored' });
  }

  const payment = await db.guestPayment.findUnique({ where: { reference } });
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }
  if (payment.status === 'success') {
    return NextResponse.json({ status: 'already_processed' });
  }

  const metadata = verifyJson.data.metadata || {};
  const credits = parseInt(metadata.credits || String(payment.credits), 10) || payment.credits;

  await db.$transaction([
    db.guestPayment.update({ where: { id: payment.id }, data: { status: 'success' } }),
    db.guestUser.update({
      where: { id: payment.guestUserId },
      data: { credits: { increment: credits } },
    }),
  ]);

  return NextResponse.json({ status: 'ok' });
}
