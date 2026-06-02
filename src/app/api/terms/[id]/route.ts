import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/terms/[id] - Get single term
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const term = await db.term.findUnique({
      where: { id },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!term) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && term.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ data: term });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/terms/[id] - Update a term
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, order, startDate, endDate, isCurrent, isLocked } = body;

    const existing = await db.term.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If setting this term as current, unset all other terms in same academic year
    if (isCurrent === true) {
      await db.term.updateMany({
        where: { schoolId: existing.schoolId, academicYearId: existing.academicYearId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const term = await db.term.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(order !== undefined && { order }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(isCurrent !== undefined && { isCurrent }),
        ...(isLocked !== undefined && { isLocked }),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: term, message: 'Term updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
