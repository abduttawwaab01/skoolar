import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const record = await db.healthRecord.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: 'Health record not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && record.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error('GET /api/health-records/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db.healthRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Health record not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: _, ...updateData } = body;
    if (updateData.lastCheckup) updateData.lastCheckup = new Date(updateData.lastCheckup);

    const record = await db.healthRecord.update({ where: { id }, data: updateData });
    return NextResponse.json({ data: record, message: 'Health record updated' });
  } catch (error) {
    console.error('PUT /api/health-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update health record' }, { status: 500 });
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

    const existing = await db.healthRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Health record not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.healthRecord.delete({ where: { id } });
    return NextResponse.json({ message: 'Health record deleted' });
  } catch (error) {
    console.error('DELETE /api/health-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete health record' }, { status: 500 });
  }
}
