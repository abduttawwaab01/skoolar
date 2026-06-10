import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  schoolId: z.string().optional(),
  academicYearId: z.string().min(1, 'Academic year is required'),
  termId: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  weekStartDate: z.string().optional(),
  weekEndDate: z.string().optional(),
  isPublished: z.boolean().optional(),
  slots: z.array(z.object({
    termId: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6),
    period: z.number().min(1),
    startTime: z.string(),
    endTime: z.string(),
    classId: z.string(),
    subjectId: z.string(),
    teacherId: z.string().nullable().optional(),
    room: z.string().nullable().optional(),
    isBreak: z.boolean().optional(),
  })).optional(),
});

async function checkTeacherConflict(schoolId: string, teacherId: string, dayOfWeek: number, startTime: string, endTime: string, excludeSlotId?: string) {
  const conflicts = await db.timetableSlot.findMany({
    where: {
      teacherId,
      dayOfWeek,
      isCancelled: false,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      timetable: { schoolId, deletedAt: null },
    },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
      timetable: { select: { name: true } },
    },
  });
  return conflicts.filter(s => timesOverlap(s.startTime, s.endTime, startTime, endTime));
}

async function checkRoomConflict(schoolId: string, room: string, dayOfWeek: number, startTime: string, endTime: string, excludeSlotId?: string) {
  const conflicts = await db.timetableSlot.findMany({
    where: {
      room,
      dayOfWeek,
      isCancelled: false,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      timetable: { schoolId, deletedAt: null },
    },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
      timetable: { select: { name: true } },
    },
  });
  return conflicts.filter(s => timesOverlap(s.startTime, s.endTime, startTime, endTime));
}

async function checkClassConflict(schoolId: string, classId: string, dayOfWeek: number, startTime: string, endTime: string, excludeSlotId?: string) {
  const conflicts = await db.timetableSlot.findMany({
    where: {
      classId,
      dayOfWeek,
      isCancelled: false,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      timetable: { schoolId, deletedAt: null },
    },
    include: {
      subject: { select: { name: true } },
      timetable: { select: { name: true } },
    },
  });
  return conflicts.filter(s => timesOverlap(s.startTime, s.endTime, startTime, endTime));
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    const academicYearId = searchParams.get('academicYearId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const teacherId = searchParams.get('teacherId') || '';
    const isActive = searchParams.get('isActive');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId, deletedAt: null };
    if (academicYearId) where.academicYearId = academicYearId;
    if (termId) where.termId = termId;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    const slotFilters: Record<string, unknown>[] = [];
    if (classId) slotFilters.push({ classId });
    if (teacherId) slotFilters.push({ teacherId });
    if (slotFilters.length > 0) {
      where.slots = { some: { AND: slotFilters } };
    }

    const [timetables, total] = await Promise.all([
      db.timetable.findMany({
        where,
        include: {
          _count: { select: { slots: true } },
          academicYear: { select: { id: true, name: true } },
          term: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.timetable.count({ where }),
    ]);

    const classes = await db.class.findMany({
      where: { schoolId, deletedAt: null },
      include: { classTeacher: { include: { user: { select: { name: true } } } } },
      orderBy: { name: 'asc' },
    });

    const subjects = await db.subject.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    const teachers = await db.teacher.findMany({
      where: { schoolId, deletedAt: null },
      include: { user: { select: { name: true, id: true } } },
      orderBy: { user: { name: 'asc' } },
    });

    const academicYears = await db.academicYear.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: 'desc' },
    });

    const terms = await db.term.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: { academicYear: { select: { name: true } } },
    });

    let userProfile: { teacherId?: string; studentId?: string; classId?: string | null } | null = null;
    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({ where: { userId: auth.userId || auth.id } });
      if (teacher) userProfile = { teacherId: teacher.id };
    } else if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({ where: { userId: auth.userId || auth.id } });
      if (student) userProfile = { studentId: student.id, classId: student.classId };
    }

    return NextResponse.json({
      data: timetables,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      classes,
      subjects,
      teachers,
      academicYears,
      terms,
      userProfile,
    });
  } catch (error) {
    console.error('Timetable GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch timetables' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && body.schoolId ? body.schoolId : (auth.schoolId || '');

    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const parsed = createSchema.parse({ ...body, schoolId: targetSchoolId });
    if (parsed.schoolId) delete parsed.schoolId;

    const existing = await db.timetable.findUnique({
      where: { schoolId_name: { schoolId: targetSchoolId, name: parsed.name } },
    });
    if (existing) {
      return NextResponse.json({ error: `A timetable named "${parsed.name}" already exists in this school` }, { status: 409 });
    }

    const timetable = await db.timetable.create({
      data: {
        schoolId: targetSchoolId,
        academicYearId: parsed.academicYearId,
        termId: parsed.termId || null,
        name: parsed.name,
        description: parsed.description || null,
        weekStartDate: parsed.weekStartDate ? new Date(parsed.weekStartDate) : null,
        weekEndDate: parsed.weekEndDate ? new Date(parsed.weekEndDate) : null,
        isPublished: parsed.isPublished || false,
        createdBy: auth.userId || auth.id,
      },
    });

    const conflicts: Array<{ type: string; details: unknown }> = [];

    if (parsed.slots && parsed.slots.length > 0) {
      for (const slot of parsed.slots) {
        if (slot.teacherId) {
          const teacherConflicts = await checkTeacherConflict(targetSchoolId, slot.teacherId, slot.dayOfWeek, slot.startTime, slot.endTime);
          if (teacherConflicts.length > 0) {
            conflicts.push({ type: 'teacher', details: { teacherId: slot.teacherId, dayOfWeek: slot.dayOfWeek, period: slot.period, conflicts: teacherConflicts } });
          }
        }
        if (slot.room) {
          const roomConflicts = await checkRoomConflict(targetSchoolId, slot.room, slot.dayOfWeek, slot.startTime, slot.endTime);
          if (roomConflicts.length > 0) {
            conflicts.push({ type: 'room', details: { room: slot.room, dayOfWeek: slot.dayOfWeek, period: slot.period, conflicts: roomConflicts } });
          }
        }
        const classConflicts = await checkClassConflict(targetSchoolId, slot.classId, slot.dayOfWeek, slot.startTime, slot.endTime);
        if (classConflicts.length > 0) {
          conflicts.push({ type: 'class', details: { classId: slot.classId, dayOfWeek: slot.dayOfWeek, period: slot.period, conflicts: classConflicts } });
        }
      }

      await db.timetableSlot.createMany({
        data: parsed.slots.map(s => ({
          timetableId: timetable.id,
          termId: s.termId || parsed.termId || '',
          dayOfWeek: s.dayOfWeek,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          classId: s.classId,
          subjectId: s.subjectId,
          teacherId: s.teacherId || null,
          room: s.room || null,
          isBreak: s.isBreak || false,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: timetable,
      warnings: conflicts.length > 0 ? conflicts : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as unknown as { errors: any[] };
      return NextResponse.json({ error: 'Validation failed', details: zodError.errors }, { status: 400 });
    }
    console.error('Timetable POST error:', error);
    return NextResponse.json({ error: 'Failed to create timetable' }, { status: 500 });
  }
}
