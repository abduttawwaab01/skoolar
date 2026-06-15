import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const design = await db.reportCardDesign.findUnique({ where: { id } });
    if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && design.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: design });
  } catch (error) {
    console.error('GET /api/report-card-designs/[id] error:', error);
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

    const existing = await db.reportCardDesign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: _, ...updateData } = body;

    const design = await db.reportCardDesign.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: design, message: 'Design updated' });
  } catch (error) {
    console.error('PUT /api/report-card-designs/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update design' }, { status: 500 });
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

    const existing = await db.reportCardDesign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.reportCardDesign.delete({ where: { id } });

    return NextResponse.json({ message: 'Design deleted' });
  } catch (error) {
    console.error('DELETE /api/report-card-designs/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete design' }, { status: 500 });
  }
}
