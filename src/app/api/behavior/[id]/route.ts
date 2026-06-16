import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const log = await db.behaviorLog.findUnique({
      where: { id },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
    if (!log) return NextResponse.json({ error: 'Behavior log not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && log.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: log });
  } catch (error) {
    console.error('GET /api/behavior/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const existing = await db.behaviorLog.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Behavior log not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.behaviorLog.delete({ where: { id } });
    return NextResponse.json({ message: 'Behavior log deleted' });
  } catch (error) {
    console.error('DELETE /api/behavior/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete behavior log' }, { status: 500 });
  }
}
