import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const timetable = await db.timetable.findUnique({
      where: { id },
      include: { _count: { select: { slots: true } } },
    });

    if (!timetable || timetable.deletedAt) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && timetable.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!timetable.isPublished && timetable._count.slots === 0) {
      return NextResponse.json(
        { error: 'Cannot publish a timetable with no slots. Add at least one slot first.' },
        { status: 400 }
      );
    }

    const updated = await db.timetable.update({
      where: { id },
      data: { isPublished: !timetable.isPublished },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: updated.isPublished ? 'Timetable published successfully' : 'Timetable unpublished',
    });
  } catch (error) {
    console.error('Publish toggle error:', error);
    return NextResponse.json({ error: 'Failed to toggle publish status' }, { status: 500 });
  }
}
