import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_PERIODS = [
  { period: 1, startTime: '08:00', endTime: '08:40' },
  { period: 2, startTime: '08:40', endTime: '09:20' },
  { period: 3, startTime: '09:20', endTime: '10:00' },
  { period: 4, startTime: '10:00', endTime: '10:40' },
  { period: 5, startTime: '10:40', endTime: '11:20' },
  { period: 6, startTime: '11:20', endTime: '12:00' },
  { period: 7, startTime: '12:00', endTime: '12:40' },
  { period: 8, startTime: '12:40', endTime: '13:20' },
  { period: 9, startTime: '13:20', endTime: '14:00' },
  { period: 10, startTime: '14:00', endTime: '14:40' },
];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const academicYearId = searchParams.get('academicYearId') || '';
    const termId = searchParams.get('termId') || '';
    const classId = searchParams.get('classId') || '';
    const timetableId = searchParams.get('timetableId') || '';

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    // Get timetables
    const timetables = await db.timetable.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // Get classes
    const classes = await db.class.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        classTeacher: { include: { user: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    // Get subjects
    const subjects = await db.subject.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    // Get teachers
    const teachers = await db.teacher.findMany({
      where: { schoolId, deletedAt: null },
      include: { user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    });

    // Get academic years
    const academicYears = await db.academicYear.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: 'desc' },
    });

    // Get terms
    const terms = await db.term.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: { academicYear: { select: { name: true } } },
    });

    // Get timetable slots if timetableId provided
    let slots: unknown[] = [];
    if (timetableId) {
      slots = await db.timetableSlot.findMany({
        where: { timetableId },
        orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      });
    }

    return NextResponse.json({
      data: timetables,
      classes,
      subjects,
      teachers,
      academicYears,
      terms,
      slots,
      days: DAYS,
      defaultPeriods: DEFAULT_PERIODS,
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
    const { schoolId, academicYearId, name, slots, isPublished } = body;

    if (!schoolId || !academicYearId || !name) {
      return NextResponse.json(
        { error: 'schoolId, academicYearId, and name are required' },
        { status: 400 }
      );
    }

    // Create timetable
    const timetable = await db.timetable.create({
      data: {
        schoolId,
        academicYearId,
        name,
        isPublished: isPublished || false,
      },
    });

    // If slots provided, create them
    if (slots && Array.isArray(slots) && slots.length > 0) {
      await db.timetableSlot.createMany({
        data: slots.map((slot: { termId?: string; dayOfWeek: number; period: number; startTime: string; endTime: string; classId: string; subjectId: string; teacherId?: string; room?: string; isBreak?: boolean }) => ({
          timetableId: timetable.id,
          termId: slot.termId || '',
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
          startTime: slot.startTime,
          endTime: slot.endTime,
          classId: slot.classId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId || null,
          room: slot.room || null,
          isBreak: slot.isBreak || false,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: timetable,
    });
  } catch (error) {
    console.error('Timetable POST error:', error);
    return NextResponse.json({ error: 'Failed to create timetable' }, { status: 500 });
  }
}