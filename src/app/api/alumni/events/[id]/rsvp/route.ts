import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id: eventId } = await params;

    const event = await db.alumniEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && event.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const student = await db.student.findUnique({ where: { userId: auth.userId } });
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const alumni = await db.alumni.findUnique({ where: { studentId: student.id } });
    if (!alumni) {
      return NextResponse.json({ error: 'Alumni profile not found. Only alumni can RSVP.' }, { status: 403 });
    }

    const body = await request.json();
    const status = body.status || 'attending';
    const guests = body.guests || 0;
    const message = body.message || null;

    if (!['attending', 'not_attending', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid RSVP status' }, { status: 400 });
    }

    if (event.maxAttendees && status === 'attending') {
      const currentAttending = await db.alumniEventRSVP.count({
        where: { eventId, status: 'attending' },
      });
      if (currentAttending >= event.maxAttendees) {
        return NextResponse.json({ error: 'Event is at maximum capacity' }, { status: 409 });
      }
    }

    const rsvp = await db.alumniEventRSVP.upsert({
      where: { eventId_alumniId: { eventId, alumniId: alumni.id } },
      update: { status, guests, message },
      create: { eventId, alumniId: alumni.id, status, guests, message },
    });

    return NextResponse.json({ data: rsvp, message: 'RSVP updated successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API Alumni RSVP POST]', error);
    return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id: eventId } = await params;

    const event = await db.alumniEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && event.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const rsvps = await db.alumniEventRSVP.findMany({
      where: { eventId },
      include: {
        alumni: {
          select: {
            id: true,
            currentOccupation: true,
            employer: true,
            student: {
              select: {
                user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: rsvps, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API Alumni RSVP GET]', error);
    return NextResponse.json({ error: 'Failed to fetch RSVPs' }, { status: 500 });
  }
}
