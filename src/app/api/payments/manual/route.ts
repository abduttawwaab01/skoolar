import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { schoolId, planId, amount, transferDate, notes } = body;

    if (!schoolId || !planId || !amount || !transferDate) {
      return NextResponse.json(
        { error: 'schoolId, planId, amount, and transferDate are required' },
        { status: 400 }
      );
    }

    // Verify plan exists
    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Subscription plan not found' }, { status: 404 });
    }

    // Verify school exists
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Verify user has access to this school
    if (authResult.role !== 'SUPER_ADMIN' && authResult.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate subscription period
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Create pending payment record
    const payment = await db.platformPayment.create({
      data: {
        schoolId,
        planId,
        reference: `manual-${Date.now()}`,
        amount: Number(amount),
        currency: 'NGN',
        status: 'pending_verification',
        startDate,
        endDate,
        channel: 'bank_transfer',
      },
    });

    return NextResponse.json(
      {
        message: 'Payment submitted for verification. We will review and activate your plan shortly.',
        data: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          reference: payment.reference,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET - Get pending manual payments (for Super Admin)
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const schoolId = searchParams.get('schoolId');

    const where: Record<string, unknown> = {
      channel: 'bank_transfer',
    };

    if (status) {
      where.status = status;
    }

    if (schoolId) {
      where.schoolId = schoolId;
    }

    const payments = await db.platformPayment.findMany({
      where,
      include: {
        school: {
          select: { id: true, name: true, slug: true },
        },
        plan: {
          select: { id: true, name: true, displayName: true, price: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ data: payments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Verify/approve or reject manual payment (Super Admin only)
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { paymentId, action, notes } = body; // action: 'approve' | 'reject'

    if (!paymentId || !action) {
      return NextResponse.json(
        { error: 'paymentId and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Find the payment
    const payment = await db.platformPayment.findUnique({
      where: { id: paymentId },
      include: { plan: true, school: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.channel !== 'bank_transfer') {
      return NextResponse.json({ error: 'This is not a bank transfer payment' }, { status: 400 });
    }

    // Calculate new subscription period
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    if (action === 'approve') {
      // Update payment status to success
      await db.platformPayment.update({
        where: { id: paymentId },
        data: {
          status: 'success',
          channel: 'bank_transfer_verified',
        },
      });

      // Update school's plan
      await db.school.update({
        where: { id: payment.schoolId },
        data: { planId: payment.planId },
      });

      return NextResponse.json({
        message: `Payment approved! ${payment.school.name} has been upgraded to ${payment.plan?.displayName || 'the selected plan'}.`,
        success: true,
      });
    } else {
      // Reject payment
      await db.platformPayment.update({
        where: { id: paymentId },
        data: {
          status: 'failed',
        },
      });

      return NextResponse.json({
        message: 'Payment has been rejected.',
        success: false,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}