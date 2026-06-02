import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// PUT /api/academic-years/[id] - Update an academic year
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, startDate, endDate, isCurrent, isLocked } = body;

    const existing = await db.academicYear.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If setting this year as current, unset all other years in same school
    if (isCurrent === true) {
      await db.academicYear.updateMany({
        where: { schoolId: existing.schoolId, isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      });
    }

    const academicYear = await db.academicYear.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(isCurrent !== undefined && { isCurrent }),
        ...(isLocked !== undefined && { isLocked }),
      },
    });

    return NextResponse.json({ data: academicYear, message: 'Academic year updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/academic-years/[id] - Get single academic year
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const academicYear = await db.academicYear.findUnique({
      where: { id },
      include: {
        terms: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && academicYear.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ data: academicYear });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
