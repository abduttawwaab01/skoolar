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
    const { schoolId, planId, email, amount, studentCount, duration = 'month', schoolType, planCode } = body;

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

    if (plan.pricingType === 'free') {
      return NextResponse.json({ error: 'Free plan does not require payment' }, { status: 400 });
    }

    if (plan.pricingType === 'custom') {
      return NextResponse.json({ error: 'Custom plans require contacting sales' }, { status: 400 });
    }

    // Look up pricing from PlanPricing
    const resolvedSchoolType = schoolType || school.schoolType || 'primary';
    const pricing = await db.planPricing.findUnique({
      where: { planId_schoolType: { planId, schoolType: resolvedSchoolType } },
    });
    if (!pricing) {
      return NextResponse.json({ error: 'Pricing not found for this plan and school type' }, { status: 400 });
    }

    // Calculate amount from PlanPricing
    const now = new Date();
    const startDate = now;
    let endDate: Date;
    let paymentAmount: number;

    const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    const months = durationMonthMap[duration] || 1;
    if (duration === 'session') {
      paymentAmount = (studentCount ?? 1) * pricing.sessionPrice;
    } else if (duration === 'term') {
      paymentAmount = (studentCount ?? 1) * pricing.termPrice;
    } else {
      paymentAmount = (studentCount ?? 1) * pricing.monthlyPrice;
    }
    endDate = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());

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
        schoolType: resolvedSchoolType,
        studentCount: studentCount ?? 1,
        duration,
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
            type: 'admin_subscription',
            schoolId,
            planId,
            planName: plan.name,
            duration,
          },
        };

        // Prefer the plan's configured Paystack plan code, otherwise use the provided code
        const planCodeToUse = plan.paystackPlanCode || planCode;
        if (planCodeToUse) {
          paystackBody.plan = planCodeToUse;
          paystackBody.metadata = {
            ...(paystackBody.metadata || {}),
            paystackPlanCode: planCodeToUse,
          };
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
    const platformSettings = await db.platformSettings.findFirst();
    const bankDetails = platformSettings
      ? {
          bankName: platformSettings.paymentBankName,
          accountNumber: platformSettings.paymentBankAccount,
          accountName: platformSettings.paymentBankAccountName,
        }
      : { bankName: 'PalmPay', accountNumber: '9033460322', accountName: 'Skoolar' };

    const whatsappNumber = '+2349152929772';
    const whatsappMessage = encodeURIComponent(
      `Hello, I have initiated a subscription payment.\n\nReference: ${reference}\nAmount: ₦${paymentAmount.toLocaleString()}\n\nI have made the payment and am sending this for verification.`
    );

    return NextResponse.json({
      data: {
        payment,
        reference,
        amount: paymentAmount,
        currency: 'NGN',
        publicKey: PAYSTACK_PUBLIC_KEY,
        bankDetails,
        whatsappUrl: `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`,
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
