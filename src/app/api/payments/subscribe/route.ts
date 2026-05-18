import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/payments/subscribe - Initialize Paystack payment
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { schoolId, planId, email, amount, duration = 'monthly', planCode } = body;

    if (!schoolId || !planId || !email) {
      return NextResponse.json(
        { error: 'schoolId, planId, and email are required' },
        { status: 400 }
      );
    }

    // Verify plan exists
    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 });
    }
    if (!plan.isActive) {
      return NextResponse.json({ error: 'Subscription plan is not active' }, { status: 400 });
    }

    // Verify school exists
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Calculate amount and dates
    const paymentAmount = amount ?? plan.price;
    const now = new Date();
    const startDate = now;
    let endDate: Date;

    if (duration === 'yearly') {
      endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    } else {
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    // Generate unique reference
    const reference = `skoolar_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    // Create pending payment record
    const payment = await db.platformPayment.create({
      data: {
        schoolId,
        planId,
        reference,
        amount: paymentAmount,
        currency: 'NGN',
        status: 'pending',
        startDate,
        endDate,
      },
    });

    // Initialize Paystack transaction
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
    const paystackBaseUrl = 'https://api.paystack.co';

    // If Paystack key is configured, attempt to initialize
    if (PAYSTACK_SECRET_KEY) {
      try {
        const paystackBody: Record<string, unknown> = {
          email,
          amount: Math.round(paymentAmount * 100), // Paystack expects kobo
          reference,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://skoolar.org'}/dashboard?tab=subscription`,
          metadata: {
            schoolId,
            planId,
            planName: plan.name,
            duration,
          },
        };

        // If plan has a Paystack plan code, pass it for recurring subscription
        if (planCode) {
          paystackBody.plan = planCode;
        }

        const paystackResponse = await fetch(`${paystackBaseUrl}/transaction/initialize`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paystackBody),
        });

        const paystackData = await paystackResponse.json();

        if (paystackData.status && paystackData.data) {
          return NextResponse.json({
            data: {
              payment,
              authorization_url: paystackData.data.authorization_url,
              access_code: paystackData.data.access_code,
              reference: paystackData.data.reference,
              publicKey: PAYSTACK_PUBLIC_KEY,
            },
            message: 'Payment initialized successfully',
          });
        }
      } catch {
        // Paystack call failed — fall through to bank transfer flow
      }
    }

    // Paystack unavailable — return payment record so frontend shows bank transfer
    return NextResponse.json({
      data: {
        payment,
        reference,
        amount: paymentAmount,
        currency: 'NGN',
        publicKey: PAYSTACK_PUBLIC_KEY,
        instructions: PAYSTACK_SECRET_KEY
          ? 'Online payment unavailable. Please use bank transfer.'
          : 'Paystack is not configured. Please use bank transfer.',
      },
      message: PAYSTACK_SECRET_KEY
        ? 'Payment record created. Online payment unavailable — please use bank transfer.'
        : 'Payment record created. Configure Paystack for live payment processing.',
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/payments/subscribe - Get payment status by schoolId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    // Get the most recent successful payment for the school
    const payment = await db.platformPayment.findFirst({
      where: {
        schoolId,
        status: 'success',
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
            maxStudents: true,
            maxTeachers: true,
            maxClasses: true,
            features: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check if plan is still active
    let isActive = false;
    if (payment && payment.endDate) {
      isActive = new Date(payment.endDate) > new Date();
    }

    return NextResponse.json({
      data: payment ? { ...payment, isActive } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
