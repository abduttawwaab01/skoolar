import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/academic-years - List academic years for a school
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const academicYears = await db.academicYear.findMany({
      where: { schoolId, deletedAt: null },
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
    const body = await request.json();
    const { schoolId, name, startDate, endDate, isCurrent } = body;

    if (!schoolId || !name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'schoolId, name, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const academicYear = await db.academicYear.create({
      data: {
        schoolId,
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
