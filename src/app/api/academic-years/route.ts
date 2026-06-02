import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/academic-years - List academic years for a school
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const academicYears = await db.academicYear.findMany({
      where: { schoolId: targetSchoolId, deletedAt: null },
      include: {
        terms: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: academicYears });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/academic-years - Create academic year (admin only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: rawSchoolId, name, startDate, endDate, isCurrent } = body;

    // SECURITY: Auth token schoolId wins. Body is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && rawSchoolId
      ? rawSchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'schoolId, name, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const academicYear = await db.academicYear.create({
      data: {
        schoolId: targetSchoolId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: isCurrent || false,
      },
    });

    return NextResponse.json({ data: academicYear, message: 'Academic year created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
