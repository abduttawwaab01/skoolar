import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const reportCard = await db.reportCard.findUnique({ where: { id }, select: { id: true, schoolId: true } });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comments = await db.reportCardComment.findMany({
      where: { reportCardId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: comments });
  } catch (error) {
    console.error('GET /api/report-cards/[id]/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reportCard = await db.reportCard.findUnique({ where: { id }, select: { id: true, schoolId: true } });
    if (!reportCard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && reportCard.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { subjectId, comment } = body;
    if (!subjectId || !comment) return NextResponse.json({ error: 'subjectId and comment required' }, { status: 400 });

    const created = await db.reportCardComment.create({
      data: { reportCardId: id, subjectId, teacherId: auth.userId || '', comment },
    });

    return NextResponse.json({ data: created });
  } catch (error) {
    console.error('POST /api/report-cards/[id]/comments error:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
