import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// PUT /api/payments/credit - Super Admin manually credits a school (for bank transfer verification)
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, planId } = body;

    if (!schoolId || !planId) {
      return NextResponse.json({ error: 'schoolId and planId are required' }, { status: 400 });
    }

    const targetPlan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!targetPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Deactivate existing active/success payments
    await db.platformPayment.updateMany({
      where: {
        schoolId,
        status: 'success',
      },
      data: { status: 'expired' },
    });

    // Create new successful payment
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const isFree = targetPlan.pricingType === 'free';
    const isCustom = targetPlan.pricingType === 'custom';

    const payment = await db.platformPayment.create({
      data: {
        schoolId,
        planId: targetPlan.id,
        reference: `manual-credit-${schoolId}-${Date.now()}`,
        amount: isFree ? 0 : (isCustom ? 0 : targetPlan.price),
        currency: 'NGN',
        status: 'success',
        startDate: new Date(),
        endDate: isFree ? new Date('2099-12-31') : oneYearFromNow,
        channel: isFree ? 'free' : (isCustom ? 'custom_quote' : 'manual_credit'),
        verifiedAt: new Date(),
      },
    });

    // Update school plan
    await db.school.update({
      where: { id: schoolId },
      data: {
        planId: targetPlan.id,
        plan: targetPlan.name,
      },
    });

    return NextResponse.json({
      success: true,
      data: payment,
      message: `School "${school.name}" credited with plan "${targetPlan.displayName}"`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
