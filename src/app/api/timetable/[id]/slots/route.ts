import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { timetableId, slots } = body;

    if (!timetableId || !slots || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: 'timetableId and slots array are required' },
        { status: 400 }
      );
    }

    // Delete existing slots for this timetable
    await db.timetableSlot.deleteMany({
      where: { timetableId },
    });

    // Create new slots
    if (slots.length > 0) {
      await db.timetableSlot.createMany({
        data: slots.map((slot: { termId?: string; dayOfWeek: number; period: number; startTime: string; endTime: string; classId: string; subjectId: string; teacherId?: string; room?: string; isBreak?: boolean }) => ({
          timetableId,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Timetable slots POST error:', error);
    return NextResponse.json({ error: 'Failed to save slots' }, { status: 500 });
  }
}