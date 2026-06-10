import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { z } from 'zod';

const slotSchema = z.object({
  termId: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6),
  period: z.number().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  isBreak: z.boolean().optional(),
  schemeOfWorkEntryId: z.string().nullable().optional(),
});

const bulkUpdateSchema = z.object({
  slots: z.array(slotSchema),
});

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function getTimetableSchoolId(timetableId: string): Promise<string | null> {
  const tt = await db.timetable.findUnique({ where: { id: timetableId }, select: { schoolId: true } });
  return tt?.schoolId || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const schoolId = await getTimetableSchoolId(id);
    if (!schoolId) return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get('dayOfWeek');
    const classId = searchParams.get('classId');
    const period = searchParams.get('period');

    const where: Record<string, unknown> = { timetableId: id };
    if (dayOfWeek) where.dayOfWeek = parseInt(dayOfWeek);
    if (classId) where.classId = classId;
    if (period) where.period = parseInt(period);

    const slots = await db.timetableSlot.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      include: {
        class: { select: { id: true, name: true, section: true, grade: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, user: { select: { name: true } } } },
        term: { select: { id: true, name: true } },
        schemeOfWorkEntry: {
          select: {
            id: true, weekNumber: true, topic: true, subTopic: true,
            learningObjectives: true, status: true,
            schemeOfWork: { select: { id: true, subjectId: true, classId: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: slots });
  } catch (error) {
    console.error('Slots GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const schoolId = await getTimetableSchoolId(id);
    if (!schoolId) return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
    if (auth.role !== 'SUPER_ADMIN' && schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkUpdateSchema.parse(body);

    await db.timetableSlot.deleteMany({ where: { timetableId: id } });

    const warnings: Array<{ type: string; details: unknown }> = [];

    if (parsed.slots.length > 0) {
      for (const slot of parsed.slots) {
        if (slot.teacherId) {
          const teacherConflicts = await db.timetableSlot.findMany({
            where: {
              teacherId: slot.teacherId, dayOfWeek: slot.dayOfWeek, isCancelled: false,
              id: { not: undefined },
              timetable: { schoolId, deletedAt: null, id: { not: id } },
            },
            include: { class: { select: { name: true } }, subject: { select: { name: true } } },
          });
          const overlapping = teacherConflicts.filter(s => timesOverlap(s.startTime, s.endTime, slot.startTime, slot.endTime));
          if (overlapping.length > 0) {
            warnings.push({ type: 'teacher', details: { teacherId: slot.teacherId, dayOfWeek: slot.dayOfWeek, period: slot.period, conflicts: overlapping } });
          }
        }
        if (slot.room) {
          const roomConflicts = await db.timetableSlot.findMany({
            where: {
              room: slot.room, dayOfWeek: slot.dayOfWeek, isCancelled: false,
              timetable: { schoolId, deletedAt: null, id: { not: id } },
            },
          });
          const overlapping = roomConflicts.filter(s => timesOverlap(s.startTime, s.endTime, slot.startTime, slot.endTime));
          if (overlapping.length > 0) {
            warnings.push({ type: 'room', details: { room: slot.room, dayOfWeek: slot.dayOfWeek, period: slot.period, conflicts: overlapping } });
          }
        }
        const classConflicts = await db.timetableSlot.findMany({
          where: {
            classId: slot.classId, dayOfWeek: slot.dayOfWeek, isCancelled: false,
            timetable: { schoolId, deletedAt: null, id: { not: id } },
          },
        });
        const overlapping = classConflicts.filter(s => timesOverlap(s.startTime, s.endTime, slot.startTime, slot.endTime));
        if (overlapping.length > 0) {
          warnings.push({ type: 'class', details: { classId: slot.classId, dayOfWeek: slot.dayOfWeek, period: slot.period, conflicts: overlapping } });
        }
      }

      const timetable = await db.timetable.findUnique({ where: { id }, select: { termId: true } });

      await db.timetableSlot.createMany({
        data: parsed.slots.map(s => ({
          timetableId: id,
          termId: s.termId || timetable?.termId || '',
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          classId: s.classId,
          subjectId: s.subjectId,
          teacherId: s.teacherId || null,
          room: s.room || null,
          location: s.location || null,
          isBreak: s.isBreak || false,
          schemeOfWorkEntryId: s.schemeOfWorkEntryId || null,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      slotsCount: parsed.slots.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: (error as z.ZodError<unknown>).errors }, { status: 400 });
    }
    console.error('Slots POST error:', error);
    return NextResponse.json({ error: 'Failed to save slots' }, { status: 500 });
  }
}
