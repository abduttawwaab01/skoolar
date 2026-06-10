import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const timetableId = searchParams.get('timetableId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const timetableFilter: Record<string, unknown> = { schoolId, deletedAt: null };
    if (timetableId) timetableFilter.id = timetableId;

    const slots = await db.timetableSlot.findMany({
      where: {
        isCancelled: false,
        timetable: timetableFilter,
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
        timetable: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const teacherConflicts: Array<{
      teacherId: string; teacherName: string; dayOfWeek: number;
      slots: Array<{ id: string; startTime: string; endTime: string; subject: string; class: string; timetable: string }>;
    }> = [];

    const roomConflicts: Array<{
      room: string; dayOfWeek: number;
      slots: Array<{ id: string; startTime: string; endTime: string; subject: string; class: string }>;
    }> = [];

    const classConflicts: Array<{
      classId: string; className: string; dayOfWeek: number;
      slots: Array<{ id: string; startTime: string; endTime: string; subject: string }>;
    }> = [];

    const teacherMap = new Map<string, typeof slots>();
    const roomMap = new Map<string, typeof slots>();
    const classMap = new Map<string, typeof slots>();

    for (const slot of slots) {
      if (slot.teacherId) {
        const key = `${slot.teacherId}_${slot.dayOfWeek}`;
        if (!teacherMap.has(key)) teacherMap.set(key, []);
        teacherMap.get(key)!.push(slot);
      }
      if (slot.room) {
        const key = `${slot.room}_${slot.dayOfWeek}`;
        if (!roomMap.has(key)) roomMap.set(key, []);
        roomMap.get(key)!.push(slot);
      }
      const key = `${slot.classId}_${slot.dayOfWeek}`;
      if (!classMap.has(key)) classMap.set(key, []);
      classMap.get(key)!.push(slot);
    }

    for (const [, daySlots] of teacherMap) {
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          if (timesOverlap(daySlots[i].startTime, daySlots[i].endTime, daySlots[j].startTime, daySlots[j].endTime)) {
            teacherConflicts.push({
              teacherId: daySlots[i].teacherId!,
              teacherName: daySlots[i].teacher?.user.name || 'Unknown',
              dayOfWeek: daySlots[i].dayOfWeek,
              slots: [
                { id: daySlots[i].id, startTime: daySlots[i].startTime, endTime: daySlots[i].endTime, subject: daySlots[i].subject.name, class: daySlots[i].class.name, timetable: daySlots[i].timetable.name },
                { id: daySlots[j].id, startTime: daySlots[j].startTime, endTime: daySlots[j].endTime, subject: daySlots[j].subject.name, class: daySlots[j].class.name, timetable: daySlots[j].timetable.name },
              ],
            });
          }
        }
      }
    }

    for (const [, daySlots] of roomMap) {
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          if (timesOverlap(daySlots[i].startTime, daySlots[i].endTime, daySlots[j].startTime, daySlots[j].endTime)) {
            roomConflicts.push({
              room: daySlots[i].room!,
              dayOfWeek: daySlots[i].dayOfWeek,
              slots: [
                { id: daySlots[i].id, startTime: daySlots[i].startTime, endTime: daySlots[i].endTime, subject: daySlots[i].subject.name, class: daySlots[i].class.name },
                { id: daySlots[j].id, startTime: daySlots[j].startTime, endTime: daySlots[j].endTime, subject: daySlots[j].subject.name, class: daySlots[j].class.name },
              ],
            });
          }
        }
      }
    }

    for (const [, daySlots] of classMap) {
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          if (timesOverlap(daySlots[i].startTime, daySlots[i].endTime, daySlots[j].startTime, daySlots[j].endTime)) {
            classConflicts.push({
              classId: daySlots[i].classId,
              className: daySlots[i].class.name,
              dayOfWeek: daySlots[i].dayOfWeek,
              slots: [
                { id: daySlots[i].id, startTime: daySlots[i].startTime, endTime: daySlots[i].endTime, subject: daySlots[i].subject.name },
                { id: daySlots[j].id, startTime: daySlots[j].startTime, endTime: daySlots[j].endTime, subject: daySlots[j].subject.name },
              ],
            });
          }
        }
      }
    }

    return NextResponse.json({
      conflicts: {
        teacher: teacherConflicts,
        room: roomConflicts,
        class: classConflicts,
      },
      counts: {
        teacher: teacherConflicts.length,
        room: roomConflicts.length,
        class: classConflicts.length,
        total: teacherConflicts.length + roomConflicts.length + classConflicts.length,
      },
    });
  } catch (error) {
    console.error('Conflicts GET error:', error);
    return NextResponse.json({ error: 'Failed to check conflicts' }, { status: 500 });
  }
}
