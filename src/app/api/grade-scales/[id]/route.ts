import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const scale = await db.gradeScale.findUnique({ where: { id } });
    if (!scale) return NextResponse.json({ error: 'Grade scale not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && scale.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: { ...scale, thresholds: typeof scale.thresholds === 'string' ? JSON.parse(scale.thresholds) : scale.thresholds } });
  } catch (error) {
    console.error('GET /api/grade-scales/[id] error:', error);
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

    const existing = await db.gradeScale.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Grade scale not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: _, ...updateData } = body;

    if (updateData.thresholds) {
      updateData.thresholds = JSON.stringify(updateData.thresholds);
    }

    const scale = await db.gradeScale.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: scale, message: 'Grade scale updated' });
  } catch (error) {
    console.error('PUT /api/grade-scales/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update grade scale' }, { status: 500 });
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

    const existing = await db.gradeScale.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Grade scale not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.gradeScale.delete({ where: { id } });

    return NextResponse.json({ message: 'Grade scale deleted' });
  } catch (error) {
    console.error('DELETE /api/grade-scales/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete grade scale' }, { status: 500 });
  }
}
