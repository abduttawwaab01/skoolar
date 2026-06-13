import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/trusted-schools - Public: returns schools marked as trusted
export async function GET() {
  try {
    const [schools, totalSchools] = await Promise.all([
      db.school.findMany({
        where: { isTrusted: true, deletedAt: null },
        orderBy: [{ trustedOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          primaryColor: true,
          secondaryColor: true,
          website: true,
        },
      }),
      db.school.count({ where: { deletedAt: null } }),
    ]);

    return NextResponse.json({ data: schools, total: totalSchools });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/trusted-schools - SUPER_ADMIN only: update trusted status
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, isTrusted, trustedOrder, logo } = body;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    // Auto-activate when marking as trusted; never deactivate when removing trust
    const school = await db.school.update({
      where: { id: schoolId },
      data: {
        ...(isTrusted !== undefined && { isTrusted }),
        ...(isTrusted === true && { isActive: true }),
        ...(trustedOrder !== undefined && { trustedOrder }),
        ...(logo !== undefined && { logo }),
      },
    });

    return NextResponse.json({ data: school, message: 'School updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
