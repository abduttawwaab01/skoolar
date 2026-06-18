import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();

    // Get the latest payment ID per school using groupBy
    const latestPerSchool = await db.platformPayment.groupBy({
      by: ['schoolId'],
      where: {
        status: 'success',
        endDate: { lt: now },
        plan: { pricingType: { not: 'free' } },
      },
      _max: { createdAt: true },
    });

    const schoolIds = latestPerSchool.map(g => g.schoolId);
    const maxDates = latestPerSchool.map(g => g._max.createdAt);

    if (schoolIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch the full latest payment records
    const expiredPayments = await db.platformPayment.findMany({
      where: {
        schoolId: { in: schoolIds },
        status: 'success',
        endDate: { lt: now },
        plan: { pricingType: { not: 'free' } },
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            schoolType: true,
            plan: true,
            isActive: true,
            _count: { select: { students: true, teachers: true, classes: true } },
          },
        },
        plan: {
          select: { id: true, name: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Deduplicate: keep only the latest payment per school
    const grouped = new Map<string, typeof expiredPayments[number]>();
    for (const payment of expiredPayments) {
      const existing = grouped.get(payment.schoolId);
      if (!existing || payment.createdAt > existing.createdAt) {
        grouped.set(payment.schoolId, payment);
      }
    }

    const result = Array.from(grouped.values()).map((payment) => {
      const daysSinceExpiry = Math.floor(
        (now.getTime() - new Date(payment.endDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...payment,
        daysSinceExpiry,
        expiredAt: payment.endDate,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
