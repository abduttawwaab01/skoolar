import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/payments/verify?reference=xxx - Check payment record status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json({ error: 'reference is required' }, { status: 400 });
    }

    // Find our payment record
    const payment = await db.platformPayment.findUnique({
      where: { reference },
      include: { plan: { select: { id: true, name: true, displayName: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const isActive = payment.endDate ? new Date(payment.endDate) > new Date() : false;

    return NextResponse.json({
      data: {
        ...payment,
        isActive,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
