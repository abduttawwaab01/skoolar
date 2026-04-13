import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/terms - List terms with filters
export async function GET(request: NextRequest) {
  try {
    const authResponse = await requireAuth(request);
    if (authResponse instanceof NextResponse) return authResponse;
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

// GET /api/terms/[id] - Get single term
export async function GET_ID(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json({ data: term });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
