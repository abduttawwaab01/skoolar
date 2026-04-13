import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

// POST - Add credit to a school (Super Admin or School Admin)
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { targetSchoolId, amount, durationMonths, reason } = body;

    // School Admins can only add credit to their own school
    // Super Admins can add to any school
    const schoolId = authResult.role === 'SUPER_ADMIN' 
      ? targetSchoolId 
      : authResult.schoolId;

    if (!schoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    const duration = durationMonths || 1;

    // Get the school and current plan
    const school = await db.school.findUnique({
      where: { id: schoolId },
      include: {
        subscriptionPlan: true,
      },
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Ensure we have a valid planId
    if (!school.planId) {
      // Get the free plan as fallback
      const freePlan = await db.subscriptionPlan.findUnique({ where: { name: 'free' } });
      if (!freePlan) {
        return NextResponse.json({ error: 'No subscription plan found' }, { status: 400 });
      }
      school.planId = freePlan.id;
    }

    const planId = school.planId;

    // Calculate new subscription period
    const now = new Date();
    let startDate = now;
    let endDate = new Date(now.getFullYear(), now.getMonth() + duration, now.getDate());

    // If there's an active payment, extend from its end date
    const existingPayment = await db.platformPayment.findFirst({
      where: {
        schoolId,
        status: 'success',
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    });

    if (existingPayment && existingPayment.endDate) {
      startDate = new Date(existingPayment.endDate);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + duration, startDate.getDate());
    }

    // Create credit/payment record
    const payment = await db.platformPayment.create({
      data: {
        schoolId,
        planId: planId,
        reference: `credit-${Date.now()}`,
        amount: Number(amount),
        currency: 'NGN',
        status: 'success',
        startDate,
        endDate,
        channel: 'offline_credit',
      },
    });

    return NextResponse.json(
      {
        message: `Credit of ${amount} added successfully. Subscription extended to ${endDate.toLocaleDateString()}.`,
        data: {
          id: payment.id,
          amount: payment.amount,
          startDate: payment.startDate,
          endDate: payment.endDate,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Get credit history for a school
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    // School Admins can only view their own school's credits
    const targetSchoolId = authResult.role === 'SUPER_ADMIN' && schoolId
      ? schoolId
      : authResult.schoolId;

    if (!targetSchoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      );
    }

    const credits = await db.platformPayment.findMany({
      where: {
        schoolId: targetSchoolId,
        channel: 'offline_credit',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ data: credits });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}