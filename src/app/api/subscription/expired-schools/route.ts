import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();

    const expiredPayments = await db.platformPayment.findMany({
      where: {
        status: { in: ['success', 'active'] },
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
      orderBy: { endDate: 'desc' },
    });

    const groupedBySchool = new Map();
    for (const payment of expiredPayments) {
      const schoolId = payment.schoolId;
      if (!groupedBySchool.has(schoolId) || new Date(payment.createdAt) > new Date(groupedBySchool.get(schoolId).createdAt)) {
        groupedBySchool.set(schoolId, payment);
      }
    }

    const result = Array.from(groupedBySchool.values()).map((payment) => {
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
