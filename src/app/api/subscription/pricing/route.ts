import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-middleware';

export async function GET() {
  try {
    const pricing = await db.planPricing.findMany({
      include: {
        plan: { select: { id: true, name: true, displayName: true } },
      },
      orderBy: [{ planId: 'asc' }, { schoolType: 'asc' }],
    });

    return NextResponse.json({ success: true, data: pricing });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { id, monthlyPrice, termPrice, sessionPrice } = body;

    if (!id) {
      return NextResponse.json({ error: 'Pricing ID is required' }, { status: 400 });
    }

    const existing = await db.planPricing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pricing record not found' }, { status: 404 });
    }

    const updated = await db.planPricing.update({
      where: { id },
      data: {
        ...(monthlyPrice !== undefined && { monthlyPrice }),
        ...(termPrice !== undefined && { termPrice }),
        ...(sessionPrice !== undefined && { sessionPrice }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Pricing updated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
