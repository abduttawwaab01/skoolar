import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/payments/verify - Verify Paystack payment by reference
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ error: 'reference is required' }, { status: 400 });
    }

    // Find the payment record first
    const payment = await db.platformPayment.findUnique({
      where: { reference },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // If already verified, return current state
    if (payment.status === 'success') {
      return NextResponse.json({
        data: payment,
        message: 'Payment already verified',
      });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    // If Paystack is not configured, require manual verification
    if (!PAYSTACK_SECRET_KEY) {
      // Log payment details securely for debugging (server-side only)
      console.error('[Payment Verify] Missing PAYSTACK_SECRET_KEY. Payment reference:', payment.reference);
      
      // Return generic error without exposing payment data
      return NextResponse.json(
        { error: 'Payment verification service temporarily unavailable' },
        { status: 503 }
      );
    }

    // Verify with Paystack API
    try {
      const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const paystackData = await paystackResponse.json();

      if (!paystackData.status || !paystackData.data) {
        // Log for debugging but don't expose payment details to client
        console.error('[Payment Verify] Paystack verification failed for reference:', reference);
        return NextResponse.json({ 
          error: 'Payment verification failed',
        }, { status: 400 });
      }

      const { status, reference: paystackRef, amount, channel, paid_at } = paystackData.data;

      if (status === 'success') {
        // Update payment as successful
        const updatedPayment = await db.platformPayment.update({
          where: { reference },
          data: {
            status: 'success',
            paystackRef: paystackRef,
            channel: channel || null,
            verifiedAt: paid_at ? new Date(paid_at) : new Date(),
          },
        });

        // Update school plan
        await db.school.update({
          where: { id: payment.schoolId },
          data: { planId: payment.planId },
        });

        return NextResponse.json({
          data: updatedPayment,
          message: 'Payment verified and school plan activated successfully',
        });
      } else {
        // Payment failed or abandoned
        await db.platformPayment.update({
          where: { reference },
          data: { status: 'failed' },
        });

        return NextResponse.json({
          data: { status: 'failed' },
          message: 'Payment verification failed',
        }, { status: 400 });
      }
     } catch (e) {
       console.error('[Payment Verify] Paystack API error:', e);
       return NextResponse.json({ 
         error: 'Failed to verify payment with payment provider',
       }, { status: 503 });
     }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
