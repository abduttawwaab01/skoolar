import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const schoolIdParam = searchParams.get('schoolId');

    const where: Record<string, unknown> = {
      channel: 'bank_transfer',
    };

    if (status) {
      where.status = status;
    }

    if (auth.role === 'SCHOOL_ADMIN') {
      where.schoolId = auth.schoolId;
    } else if (schoolIdParam) {
      where.schoolId = schoolIdParam;
    }

    const payments = await db.platformPayment.findMany({
      where,
      include: {
        school: {
          select: { id: true, name: true, slug: true, email: true, phone: true, schoolType: true },
        },
        plan: {
          select: { id: true, name: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
