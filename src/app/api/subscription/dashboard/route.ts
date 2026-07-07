import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();

    const [schools, plans, pricing, payments] = await Promise.all([
      db.school.findMany({
        where: { deletedAt: null },
        select: {
          id: true, name: true, email: true, phone: true, schoolType: true, plan: true, planId: true, isActive: true,
          logo: true, region: true, createdAt: true, trialStartDate: true, trialEndDate: true,
          _count: { select: { students: true, teachers: true, classes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.subscriptionPlan.findMany({
        where: { isActive: true },
        select: { id: true, name: true, displayName: true, pricingType: true, price: true, warningDays: true },
        orderBy: { price: 'asc' },
      }),
      db.planPricing.findMany({
        include: { plan: { select: { id: true, name: true, displayName: true } } },
        orderBy: [{ planId: 'asc' }, { schoolType: 'asc' }],
      }),
      db.platformPayment.findMany({
        where: { school: { deletedAt: null } },
        include: {
          plan: { select: { id: true, name: true, displayName: true, pricingType: true, warningDays: true } },
          school: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
    ]);

    // Group all payments by school
    const allPaymentsBySchool = new Map<string, typeof payments>();
    const latestPaymentMap = new Map<string, typeof payments[number]>();
    let activeCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let pendingApprovalCount = 0;

    for (const p of payments) {
      // All payments by school
      const arr = allPaymentsBySchool.get(p.schoolId) || [];
      arr.push(p);
      allPaymentsBySchool.set(p.schoolId, arr);

      if (p.status === 'pending' || p.status === 'pending_verification') {
        pendingApprovalCount++;
      }
      if (p.status === 'success') {
        const existing = latestPaymentMap.get(p.schoolId);
        if (!existing || p.createdAt > existing.createdAt) {
          latestPaymentMap.set(p.schoolId, p);
        }
      }
    }

    const schoolsWithStatus = schools.map(s => {
      const latest = latestPaymentMap.get(s.id);
      const allPayments = (allPaymentsBySchool.get(s.id) || []).map(p => ({
        id: p.id,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        duration: p.duration,
        amount: p.amount,
        reference: p.reference,
        channel: p.channel,
        createdAt: p.createdAt,
        planDisplayName: p.plan?.displayName || null,
      }));
      const pending = allPayments.filter(p => p.status === 'pending' || p.status === 'pending_verification');
      const isFree = latest?.plan?.pricingType === 'free' || s.plan === 'free';

      // Check trial status
      let inTrial = false;
      let trialDaysRemaining = 0;
      if (s.trialStartDate && s.trialEndDate) {
        const trialEnd = new Date(s.trialEndDate);
        const buffer = 24 * 60 * 60 * 1000;
        if (trialEnd.getTime() + buffer > now.getTime()) {
          inTrial = true;
          trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }

      let subscriptionStatus: 'active' | 'expiring_soon' | 'expired' | 'trial' | 'none' = 'none';

      if (inTrial && !latest) {
        subscriptionStatus = 'trial';
        activeCount++;
      } else if (latest && latest.endDate) {
        const endDate = new Date(latest.endDate);
        const msRemaining = endDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        const warningDays = latest.plan?.warningDays ?? 7;
        const buffer = 24 * 60 * 60 * 1000;

        if (endDate.getTime() + buffer > now.getTime()) {
          subscriptionStatus = daysRemaining <= warningDays ? 'expiring_soon' : 'active';
          if (subscriptionStatus === 'active') activeCount++;
          else expiringSoonCount++;
        } else {
          subscriptionStatus = 'expired';
          expiredCount++;
        }
      } else if (s.planId && !latest) {
        subscriptionStatus = 'none';
      } else if (!inTrial) {
        expiredCount++;
        subscriptionStatus = 'expired';
      }

      return {
        ...s,
        trialDaysRemaining: inTrial ? trialDaysRemaining : null,
        latestPayment: latest ? {
          id: latest.id,
          status: latest.status,
          startDate: latest.startDate,
          endDate: latest.endDate,
          duration: latest.duration,
          amount: latest.amount,
          reference: latest.reference,
          channel: latest.channel,
          createdAt: latest.createdAt,
          planDisplayName: latest.plan?.displayName || null,
        } : null,
        allPayments,
        pendingPayments: pending,
        subscriptionStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        schools: schoolsWithStatus,
        plans,
        pricing,
        stats: {
          totalSchools: schools.length,
          active: activeCount,
          expired: expiredCount,
          expiringSoon: expiringSoonCount,
          pendingApprovals: pendingApprovalCount,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const payment = await db.platformPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    await db.platformPayment.delete({ where: { id: paymentId } });

    return NextResponse.json({ success: true, message: 'Payment record deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { paymentId, action, endDate, duration } = body;

    if (!paymentId || !action) {
      return NextResponse.json({ error: 'paymentId and action are required' }, { status: 400 });
    }

    const payment = await db.platformPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (action === 'extend') {
      const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
      const months = (duration && durationMonthMap[duration]) ? durationMonthMap[duration] : 12;
      const newEndDate = endDate ? new Date(endDate) : new Date(payment.endDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);

      await db.platformPayment.update({
        where: { id: paymentId },
        data: { endDate: newEndDate },
      });

      return NextResponse.json({ success: true, message: `Extended to ${newEndDate.toLocaleDateString()}` });
    }

    if (action === 'change_plan') {
      const { planId } = body;
      if (!planId) {
        return NextResponse.json({ error: 'planId is required to change plan' }, { status: 400 });
      }

      const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }

      // Expire old payment
      await db.platformPayment.update({
        where: { id: paymentId },
        data: { status: 'expired' },
      });

      // Create new payment
      const startDate = new Date();
      let calculatedEndDate: Date;
      if (endDate) {
        calculatedEndDate = new Date(endDate);
      } else if (duration) {
        const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
        const months = durationMonthMap[duration] || 12;
        calculatedEndDate = new Date(startDate);
        calculatedEndDate.setMonth(calculatedEndDate.getMonth() + months);
      } else {
        calculatedEndDate = new Date(startDate);
        calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + 1);
      }

      const newPayment = await db.platformPayment.create({
        data: {
          schoolId: payment.schoolId,
          planId,
          reference: `change_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          amount: payment.amount,
          currency: 'NGN',
          status: 'success',
          channel: 'manual_upgrade',
          verifiedAt: new Date(),
          startDate,
          endDate: calculatedEndDate,
          duration: duration || null,
          schoolType: payment.schoolType,
          studentCount: payment.studentCount,
        },
      });

      await db.school.update({
        where: { id: payment.schoolId },
        data: { planId, plan: plan.name },
      });

      return NextResponse.json({ success: true, message: `Plan changed to ${plan.displayName}` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
