import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const rule = await db.promotionRule.findUnique({ where: { id } });
    if (!rule) return NextResponse.json({ error: 'Promotion rule not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && rule.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: rule });
  } catch (error) {
    console.error('GET /api/promotion-rules/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.promotionRule.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Promotion rule not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: _, ...updateData } = body;

    if (updateData.rules && typeof updateData.rules === 'object') {
      updateData.rules = JSON.stringify(updateData.rules);
    }

    const rule = await db.promotionRule.update({ where: { id }, data: updateData });

    return NextResponse.json({ data: rule, message: 'Promotion rule updated' });
  } catch (error) {
    console.error('PUT /api/promotion-rules/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update promotion rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.promotionRule.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Promotion rule not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.promotionRule.delete({ where: { id } });

    return NextResponse.json({ message: 'Promotion rule deleted' });
  } catch (error) {
    console.error('DELETE /api/promotion-rules/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete promotion rule' }, { status: 500 });
  }
}
