import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/terms - Create a new term
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId: bodySchoolId, name, order, startDate, endDate, academicYearId } = body;
    let schoolId = bodySchoolId || auth.schoolId || '';

    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId) {
      schoolId = auth.schoolId;
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }
    if (!name || !order || !startDate || !endDate || !academicYearId) {
      return NextResponse.json({ error: 'Name, order, startDate, endDate, and academicYearId are required' }, { status: 400 });
    }

    const existing = await db.term.findUnique({
      where: { academicYearId_order: { academicYearId, order } },
    });
    if (existing) {
      return NextResponse.json({ error: `A term with order ${order} already exists in this academic year` }, { status: 409 });
    }

    const term = await db.term.create({
      data: {
        schoolId,
        academicYearId,
        name,
        order,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: {
        academicYear: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: term, message: 'Term created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/terms - List terms with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    let schoolId = searchParams.get('schoolId') || auth.schoolId || '';
    const academicYearId = searchParams.get('academicYearId') || '';
    const isCurrent = searchParams.get('isCurrent') === 'true';

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId) {
      schoolId = auth.schoolId;
    }

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { deletedAt: null, schoolId };
    if (academicYearId) where.academicYearId = academicYearId;
    if (isCurrent) where.isCurrent = true;

    const terms = await db.term.findMany({
      where,
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { academicYearId: 'desc' },
        { order: 'asc' },
      ],
    });

    return NextResponse.json({ data: terms });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
