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
    const { schoolId, planId, email, amount, duration = 'monthly' } = body;

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

    // In production, you would call Paystack API here to initialize the transaction
    // For now, return the reference so the frontend can handle Paystack inline popup
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const useLiveMode = process.env.PAYSTACK_MODE === 'live';
    const paystackBaseUrl = useLiveMode
      ? 'https://api.paystack.co'
      : 'https://api.paystack.co';

    // If Paystack key is configured, attempt to initialize
    if (PAYSTACK_SECRET_KEY) {
      try {
        const paystackResponse = await fetch(`${paystackBaseUrl}/transaction/initialize`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount: Math.round(paymentAmount * 100), // Paystack expects kobo
            reference,
            metadata: {
              schoolId,
              planId,
              planName: plan.name,
              duration,
            },
          }),
        });

        const paystackData = await paystackResponse.json();

        if (paystackData.status && paystackData.data) {
          // Update payment with paystack reference if available
          return NextResponse.json({
            data: {
              payment,
              authorization_url: paystackData.data.authorization_url,
              access_code: paystackData.data.access_code,
              reference: paystackData.data.reference,
            },
            message: 'Payment initialized successfully',
          });
        }
      } catch {
        // Paystack call failed, return manual reference for testing
      }
    }

    return NextResponse.json({
      data: {
        payment,
        reference,
        amount: paymentAmount,
        currency: 'NGN',
      },
      message: 'Payment record created. Configure Paystack for live payment processing.',
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
