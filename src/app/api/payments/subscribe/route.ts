import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/payments/subscribe - Create a subscription payment via bank transfer
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { schoolId, planId, email, amount, studentCount, duration = 'month', schoolType } = body;

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

    // Look up pricing from PlanPricing
    const resolvedSchoolType = schoolType || school.schoolType || 'primary';
    const pricing = await db.planPricing.findUnique({
      where: { planId_schoolType: { planId, schoolType: resolvedSchoolType } },
    });
    if (!pricing) {
      return NextResponse.json({ error: 'Pricing not found for this plan and school type' }, { status: 400 });
    }

    // Calculate amount from PlanPricing (prices are per-school, not per-student)
    const now = new Date();
    const startDate = now;
    let endDate: Date;
    let paymentAmount: number;

    const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    const months = durationMonthMap[duration] || 1;
    if (duration === 'session') {
      paymentAmount = pricing.sessionPrice;
    } else if (duration === 'term') {
      paymentAmount = pricing.termPrice;
    } else {
      paymentAmount = pricing.monthlyPrice;
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
        channel: 'bank_transfer',
        startDate,
        endDate,
        schoolType: resolvedSchoolType,
        studentCount: 1,
        duration,
      },
    });

    // Return bank transfer details
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
        bankDetails,
        whatsappUrl: `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`,
        instructions: 'Please make a bank transfer to the account below and send a WhatsApp message for verification.',
      },
      message: 'Payment record created. Please complete your bank transfer and send a WhatsApp message for verification.',
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
