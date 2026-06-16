import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const achievement = await db.achievement.findUnique({
      where: { id },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
    if (!achievement) return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && achievement.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: achievement });
  } catch (error) {
    console.error('GET /api/achievements/[id] error:', error);
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

    const existing = await db.achievement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: _, ...updateData } = body;
    if (updateData.date) updateData.date = new Date(updateData.date);

    const achievement = await db.achievement.update({ where: { id }, data: updateData });
    return NextResponse.json({ data: achievement, message: 'Achievement updated' });
  } catch (error) {
    console.error('PUT /api/achievements/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update achievement' }, { status: 500 });
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

    const existing = await db.achievement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.achievement.delete({ where: { id } });
    return NextResponse.json({ message: 'Achievement deleted' });
  } catch (error) {
    console.error('DELETE /api/achievements/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete achievement' }, { status: 500 });
  }
}
