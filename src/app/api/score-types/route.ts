import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/score-types - List score types for a school
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };
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
    const body = await request.json();
    const { schoolId, name, type, maxMarks, weight, position, isInReport, isActive } = body;

    if (!schoolId || !name || !type) {
      return NextResponse.json(
        { error: 'schoolId, name, and type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['daily', 'weekly', 'midterm', 'exam'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const scoreType = await db.scoreType.create({
      data: {
        schoolId,
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
    const body = await request.json();
    const { id, name, type, maxMarks, weight, position, isInReport, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.scoreType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Score type not found' }, { status: 404 });
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
