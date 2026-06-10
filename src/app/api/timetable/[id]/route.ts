import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const timetable = await db.timetable.findUnique({
      where: { id },
      include: {
        academicYear: { select: { id: true, name: true } },
        term: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
        _count: { select: { slots: true } },
      },
    });

    if (!timetable || timetable.deletedAt) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && timetable.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const slots = await db.timetableSlot.findMany({
      where: { timetableId: id },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      include: {
        class: { select: { id: true, name: true, section: true, grade: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
        term: { select: { id: true, name: true } },
        schemeOfWorkEntry: {
          select: {
            id: true,
            weekNumber: true,
            topic: true,
            subTopic: true,
            learningObjectives: true,
            status: true,
            schemeOfWork: {
              select: { id: true, subjectId: true, classId: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: timetable, slots });
  } catch (error) {
    console.error('Timetable GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch timetable' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, description, weekStartDate, weekEndDate, isActive, isPublished, termId } = body;

    const existing = await db.timetable.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (name && name !== existing.name) {
      const duplicate = await db.timetable.findUnique({
        where: { schoolId_name: { schoolId: existing.schoolId, name } },
      });
      if (duplicate) {
        return NextResponse.json({ error: `A timetable named "${name}" already exists` }, { status: 409 });
      }
    }

    const timetable = await db.timetable.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(weekStartDate !== undefined && { weekStartDate: weekStartDate ? new Date(weekStartDate) : null }),
        ...(weekEndDate !== undefined && { weekEndDate: weekEndDate ? new Date(weekEndDate) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(isPublished !== undefined && { isPublished }),
        ...(termId !== undefined && { termId: termId || null }),
      },
    });

    return NextResponse.json({ success: true, data: timetable });
  } catch (error) {
    console.error('Timetable PUT error:', error);
    return NextResponse.json({ error: 'Failed to update timetable' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const existing = await db.timetable.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.timetable.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Timetable DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete timetable' }, { status: 500 });
  }
}
