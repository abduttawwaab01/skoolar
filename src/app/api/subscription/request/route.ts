import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { planId, schoolType, studentCount, duration } = body;

    if (!planId || !schoolType || !studentCount || !duration) {
      return NextResponse.json(
        { error: 'planId, schoolType, studentCount, and duration are required' },
        { status: 400 }
      );
    }

    const validSchoolTypes = ['primary', 'secondary', 'primary_secondary', 'higher_institution'];
    if (!validSchoolTypes.includes(schoolType)) {
      return NextResponse.json(
        { error: 'Invalid school type. Must be: primary, secondary, primary_secondary, or higher_institution' },
        { status: 400 }
      );
    }

    const validDurations = ['monthly', 'term', 'session'];
    if (!validDurations.includes(duration)) {
      return NextResponse.json(
        { error: 'Invalid duration. Must be: monthly, term, or session' },
        { status: 400 }
      );
    }

    if (studentCount < 1) {
      return NextResponse.json({ error: 'Student count must be at least 1' }, { status: 400 });
    }

    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Plan not found or inactive' }, { status: 404 });
    }

    const pricing = await db.planPricing.findUnique({
      where: { planId_schoolType: { planId, schoolType } },
    });
    if (!pricing) {
      return NextResponse.json(
        { error: 'No pricing configured for this plan and school type combination' },
        { status: 400 }
      );
    }

    const pricePerStudent = duration === 'monthly' ? pricing.monthlyPrice : duration === 'term' ? pricing.termPrice : pricing.sessionPrice;
    const totalAmount = pricePerStudent * studentCount;

    const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    const durationMonths = durationMonthMap[duration] || 1;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);

    const schoolId = auth.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID not found in auth' }, { status: 400 });
    }

    const reference = `sub_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payment = await db.platformPayment.create({
      data: {
        schoolId,
        planId,
        reference,
        amount: totalAmount,
        currency: 'NGN',
        status: 'pending',
        channel: 'bank_transfer',
        startDate,
        endDate,
        schoolType,
        studentCount,
        duration,
      },
    });

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
      `Hello, I have initiated a subscription upgrade request.\n\nSchool: ${auth.schoolName || schoolId}\nPlan: ${plan.displayName}\nSchool Type: ${schoolType}\nStudents: ${studentCount}\nDuration: ${durationMonths} month(s)\nAmount: ₦${totalAmount.toLocaleString()}\nReference: ${reference}\n\nI have made the payment and am sending this for verification.`
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          payment: {
            id: payment.id,
            reference: payment.reference,
            amount: payment.amount,
            status: payment.status,
            startDate: payment.startDate,
            endDate: payment.endDate,
          },
          bankDetails,
          whatsappUrl: `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`,
          whatsappNumber,
        },
        message: 'Subscription request submitted successfully. Please pay to the bank account and send a WhatsApp message for verification.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
