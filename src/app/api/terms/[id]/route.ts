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
