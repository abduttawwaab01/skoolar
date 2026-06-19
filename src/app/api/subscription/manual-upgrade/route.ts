import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { schoolId, planId, endDate, schoolType, studentCount, duration } = body;

    if (!schoolId || !planId) {
      return NextResponse.json(
        { error: 'schoolId and planId are required' },
        { status: 400 }
      );
    }

    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const startDate = new Date();
    let calculatedEndDate: Date;
    const durationMonthMap: Record<string, number> = { monthly: 1, term: 4, session: 10 };
    if (endDate) {
      calculatedEndDate = new Date(endDate);
    } else if (duration && durationMonthMap[duration]) {
      calculatedEndDate = new Date(startDate);
      calculatedEndDate.setMonth(calculatedEndDate.getMonth() + durationMonthMap[duration]);
    } else {
      calculatedEndDate = new Date(startDate);
      calculatedEndDate.setFullYear(calculatedEndDate.getFullYear() + 1);
    }

    const reference = `manual_upgrade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await db.platformPayment.updateMany({
      where: { schoolId, status: 'success' },
      data: { status: 'expired' },
    });

    await db.platformPayment.create({
      data: {
        schoolId,
        planId,
        reference,
        amount: 0,
        currency: 'NGN',
        status: 'success',
        channel: 'manual_upgrade',
        verifiedAt: new Date(),
        startDate,
        endDate: calculatedEndDate,
        schoolType: schoolType || school.schoolType,
        studentCount: studentCount || 0,
        duration: duration || null,
      },
    });

    await db.school.update({
      where: { id: schoolId },
      data: {
        planId,
        plan: plan.name,
        ...(schoolType ? { schoolType } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${school.name} has been manually upgraded to ${plan.displayName}. Expires: ${calculatedEndDate.toLocaleDateString()}`,
      data: {
        school: school.name,
        plan: plan.displayName,
        startDate,
        endDate: calculatedEndDate,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
