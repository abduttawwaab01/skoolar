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
          logo: true, region: true, createdAt: true,
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
          plan: { select: { id: true, name: true, displayName: true, pricingType: true } },
          school: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    ]);

    // Build latest payment per school + stats
    const latestPaymentMap = new Map<string, typeof payments[number]>();
    const pendingPaymentsMap = new Map<string, typeof payments[number][]>();
    let activeCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let pendingApprovalCount = 0;

    for (const p of payments) {
      if (p.status === 'pending' || p.status === 'pending_verification') {
        pendingApprovalCount++;
        const arr = pendingPaymentsMap.get(p.schoolId) || [];
        arr.push(p);
        pendingPaymentsMap.set(p.schoolId, arr);
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
      const pending = pendingPaymentsMap.get(s.id) || [];
      const isFree = latest?.plan?.pricingType === 'free' || s.plan === 'free';
      let subscriptionStatus: 'active' | 'expiring_soon' | 'expired' | 'free' | 'none' = 'none';

      if (isFree) {
        subscriptionStatus = 'free';
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
        // Has plan but no payment yet — could be new
        subscriptionStatus = 'none';
      } else {
        expiredCount++;
        subscriptionStatus = 'expired';
      }

      return {
        ...s,
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
        pendingPayments: pending.map(p => ({
          id: p.id,
          status: p.status,
          amount: p.amount,
          reference: p.reference,
          createdAt: p.createdAt,
          planDisplayName: p.plan?.displayName || null,
          channel: p.channel,
        })),
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
