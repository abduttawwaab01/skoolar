import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');

    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = { schoolId: targetSchoolId };

    if (status === 'upcoming') {
      where.eventDate = { gte: new Date() };
    } else if (status === 'past') {
      where.eventDate = { lt: new Date() };
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      db.alumniEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { eventDate: 'desc' },
        include: {
          _count: { select: { rsvps: true } },
          rsvps: {
            select: { status: true },
          },
        },
      }),
      db.alumniEvent.count({ where }),
    ]);

    const data = events.map((e) => {
      const attending = e.rsvps.filter((r) => r.status === 'attending').length;
      return { ...e, attending, rsvpCount: e._count.rsvps };
    });

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API Alumni Events GET]', error);
    return NextResponse.json({ error: 'Failed to fetch alumni events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { title, description, eventDate, location, isVirtual, meetingLink, organizer, rsvpDeadline, maxAttendees } = body;

    const targetSchoolId = auth.schoolId || '';
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    if (!title || !eventDate) {
      return NextResponse.json({ error: 'Title and event date are required' }, { status: 400 });
    }

    const event = await db.alumniEvent.create({
      data: {
        schoolId: targetSchoolId,
        title,
        description,
        eventDate: new Date(eventDate),
        location,
        isVirtual: isVirtual || false,
        meetingLink,
        organizer,
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
      },
    });

    return NextResponse.json({ data: event, message: 'Event created successfully', timestamp: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    console.error('[API Alumni Events POST]', error);
    return NextResponse.json({ error: 'Failed to create alumni event' }, { status: 500 });
  }
}
