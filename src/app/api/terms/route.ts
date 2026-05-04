import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/terms - List terms with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const academicYearId = searchParams.get('academicYearId') || '';
    const isCurrent = searchParams.get('isCurrent') === 'true';

    const where: Record<string, unknown> = { deletedAt: null };
    if (schoolId) where.schoolId = schoolId;
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
