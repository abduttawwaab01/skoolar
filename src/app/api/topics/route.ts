import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/topics - List topics
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const subjectId = searchParams.get('subjectId') || '';
    const search = searchParams.get('search') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (subjectId) where.subjectId = subjectId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const topics = await db.topic.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        subject: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: topics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/topics - Create a topic
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, subjectId } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? (body.schoolId || auth.schoolId) : auth.schoolId;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const existing = await db.topic.findFirst({
      where: { schoolId: targetSchoolId, name, subjectId: subjectId || null },
    });
    if (existing) {
      return NextResponse.json({ error: 'Topic already exists for this subject' }, { status: 409 });
    }

    const topic = await db.topic.create({
      data: {
        schoolId: targetSchoolId,
        name,
        subjectId: subjectId || null,
      },
    });

    return NextResponse.json({ data: topic }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
