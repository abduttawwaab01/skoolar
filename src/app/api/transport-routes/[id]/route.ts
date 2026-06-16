import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const route = await db.transportRoute.findUnique({ where: { id } });
    if (!route) return NextResponse.json({ error: 'Transport route not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && route.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: route });
  } catch (error) {
    console.error('GET /api/transport-routes/[id] error:', error);
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

    const existing = await db.transportRoute.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Transport route not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: _, ...updateData } = body;

    const route = await db.transportRoute.update({ where: { id }, data: updateData });
    return NextResponse.json({ data: route, message: 'Transport route updated' });
  } catch (error) {
    console.error('PUT /api/transport-routes/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update transport route' }, { status: 500 });
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

    const existing = await db.transportRoute.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Transport route not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.transportRoute.delete({ where: { id } });
    return NextResponse.json({ message: 'Transport route deleted' });
  } catch (error) {
    console.error('DELETE /api/transport-routes/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete transport route' }, { status: 500 });
  }
}
