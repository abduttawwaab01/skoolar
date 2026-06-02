import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/score-types - List score types for a school
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    // SECURITY: Auth token schoolId wins. Query param is only honored for SUPER_ADMIN.
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = { schoolId: targetSchoolId };
    if (type) where.type = type;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const scoreTypes = await db.scoreType.findMany({
      where,
      orderBy: { position: 'asc' },
    });

    return NextResponse.json({ data: scoreTypes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/score-types - Create a new score type
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { schoolId, name, type, maxMarks, weight, position, isInReport, isActive } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || schoolId);
    if (!targetSchoolId || !name || !type) {
      return NextResponse.json(
        { error: 'schoolId, name, and type are required' },
        { status: 400 }
      );
    }
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && schoolId && schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validTypes = ['midterm', 'exam'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const scoreType = await db.scoreType.create({
      data: {
        schoolId: targetSchoolId,
        name,
        type,
        maxMarks: maxMarks ?? 20,
        weight: weight ?? 1.0,
        position: position ?? 0,
        isInReport: isInReport ?? true,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ data: scoreType, message: 'Score type created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/score-types - Update a score type
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, name, type, maxMarks, weight, position, isInReport, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.scoreType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Score type not found' }, { status: 404 });
    }

    // School isolation
    if (auth.role !== 'SUPER_ADMIN' && auth.schoolId && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scoreType = await db.scoreType.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(maxMarks !== undefined && { maxMarks }),
        ...(weight !== undefined && { weight }),
        ...(position !== undefined && { position }),
        ...(isInReport !== undefined && { isInReport }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ data: scoreType, message: 'Score type updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
