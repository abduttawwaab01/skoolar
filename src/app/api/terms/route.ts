import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

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
