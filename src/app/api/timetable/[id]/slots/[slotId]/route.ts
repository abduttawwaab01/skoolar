import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id, slotId } = await params;

    const slot = await db.timetableSlot.findUnique({
      where: { id: slotId, timetableId: id },
      include: {
        class: { select: { id: true, name: true, section: true, grade: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
        term: { select: { id: true, name: true } },
        timetable: { select: { id: true, name: true, schoolId: true } },
        schemeOfWorkEntry: {
          select: {
            id: true, weekNumber: true, topic: true, subTopic: true,
            learningObjectives: true, status: true,
            schemeOfWork: { select: { id: true, subjectId: true, classId: true } },
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && slot.timetable.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ data: slot });
  } catch (error) {
    console.error('Slot GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch slot' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id, slotId } = await params;
    const body = await request.json();

    const slot = await db.timetableSlot.findUnique({
      where: { id: slotId, timetableId: id },
      include: { timetable: { select: { schoolId: true } } },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && slot.timetable.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const {
      dayOfWeek, period, startTime, endTime, classId, subjectId,
      teacherId, room, location, isBreak, isCancelled, cancelReason, schemeOfWorkEntryId,
    } = body;

    const conflicts: Array<{ type: string; details: unknown }> = [];
    const schoolId = slot.timetable.schoolId;
    const effDay = dayOfWeek ?? slot.dayOfWeek;
    const effStart = startTime ?? slot.startTime;
    const effEnd = endTime ?? slot.endTime;
    const effTeacherId = teacherId !== undefined ? teacherId : slot.teacherId;
    const effRoom = room !== undefined ? room : slot.room;
    const effClassId = classId ?? slot.classId;

    if (effTeacherId) {
      const teacherConflicts = await db.timetableSlot.findMany({
        where: {
          teacherId: effTeacherId, dayOfWeek: effDay, isCancelled: false,
          id: { not: slotId }, timetable: { schoolId, deletedAt: null },
        },
        include: { class: { select: { name: true } }, subject: { select: { name: true } } },
      });
      const overlapping = teacherConflicts.filter(s => timesOverlap(s.startTime, s.endTime, effStart, effEnd));
      if (overlapping.length > 0) {
        conflicts.push({ type: 'teacher', details: { teacherId: effTeacherId, dayOfWeek: effDay, conflicts: overlapping } });
      }
    }

    if (effRoom) {
      const roomConflicts = await db.timetableSlot.findMany({
        where: {
          room: effRoom, dayOfWeek: effDay, isCancelled: false,
          id: { not: slotId }, timetable: { schoolId, deletedAt: null },
        },
      });
      const overlapping = roomConflicts.filter(s => timesOverlap(s.startTime, s.endTime, effStart, effEnd));
      if (overlapping.length > 0) {
        conflicts.push({ type: 'room', details: { room: effRoom, dayOfWeek: effDay, conflicts: overlapping } });
      }
    }

    const classConflicts = await db.timetableSlot.findMany({
      where: {
        classId: effClassId, dayOfWeek: effDay, isCancelled: false,
        id: { not: slotId }, timetable: { schoolId, deletedAt: null },
      },
    });
    const overlapping = classConflicts.filter(s => timesOverlap(s.startTime, s.endTime, effStart, effEnd));
    if (overlapping.length > 0) {
      conflicts.push({ type: 'class', details: { classId: effClassId, dayOfWeek: effDay, conflicts: overlapping } });
    }

    const updated = await db.timetableSlot.update({
      where: { id: slotId },
      data: {
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(period !== undefined && { period }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(classId !== undefined && { classId }),
        ...(subjectId !== undefined && { subjectId }),
        ...(teacherId !== undefined && { teacherId: teacherId || null }),
        ...(room !== undefined && { room: room || null }),
        ...(location !== undefined && { location: location || null }),
        ...(isBreak !== undefined && { isBreak }),
        ...(isCancelled !== undefined && { isCancelled }),
        ...(cancelReason !== undefined && { cancelReason: cancelReason || null }),
        ...(schemeOfWorkEntryId !== undefined && { schemeOfWorkEntryId: schemeOfWorkEntryId || null }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      warnings: conflicts.length > 0 ? conflicts : undefined,
    });
  } catch (error) {
    console.error('Slot PUT error:', error);
    return NextResponse.json({ error: 'Failed to update slot' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id, slotId } = await params;

    const slot = await db.timetableSlot.findUnique({
      where: { id: slotId, timetableId: id },
      include: { timetable: { select: { schoolId: true } } },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && slot.timetable.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.timetableSlot.delete({ where: { id: slotId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Slot DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
