import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/calendar - List events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || '';
    const month = searchParams.get('month') || '';
    const type = searchParams.get('type') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const userId = searchParams.get('userId') || '';

    const where: Record<string, unknown> = {};

    if (schoolId) where.schoolId = schoolId;
    if (type) where.type = type;

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const startDate = new Date(year, mon - 1, 1);
      const endDate = new Date(year, mon, 0, 23, 59, 59);
      where.startDate = { gte: startDate, lte: endDate };
    } else if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.startDate = dateFilter;
    }

    const events = await db.schoolEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        schoolId: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        type: true,
        isAllDay: true,
        color: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        rsvps: userId ? {
          where: { userId },
          select: { id: true, userId: true, status: true, createdAt: true },
        } : {
          select: { id: true, userId: true, status: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({
      data: events,
      total: events.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/calendar - Create event
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();
    const { schoolId, title, description, startDate, endDate, location, type, isAllDay, color, createdBy } = body;

    if (!schoolId || !title || !startDate) {
      return NextResponse.json(
        { error: 'schoolId, title, and startDate are required' },
        { status: 400 }
      );
    }

    const event = await db.schoolEvent.create({
      data: {
        schoolId,
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location || null,
        type: type || 'general',
        isAllDay: isAllDay || false,
        color: color || '#059669',
        createdBy: createdBy || null,
      },
    });

    return NextResponse.json({ data: event, message: 'Event created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/calendar - Update event or RSVP
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();
    const { action, eventId, userId, status, schoolId, ...updateFields } = body;

    // RSVP action
    if (action === 'rsvp' && eventId && userId) {
      if (!schoolId) {
        return NextResponse.json({ error: 'schoolId required' }, { status: 400 });
      }

      // Upsert RSVP
      const rsvp = await db.eventRSVP.upsert({
        where: {
          eventId_userId: { eventId, userId },
        },
        create: {
          eventId,
          userId,
          status: status || 'going',
        },
        update: {
          status: status || 'going',
        },
      });

      return NextResponse.json({ data: rsvp, message: 'RSVP updated' });
    }

    // Update event fields
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
    if (data.color !== undefined) updateData.color = data.color;

    const event = await db.schoolEvent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: event, message: 'Event updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/calendar - Delete event
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  try {
    const body = await request.json();
    const { id, schoolId } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Verify ownership via schoolId
    const event = await db.schoolEvent.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (schoolId && event.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete RSVPs first
    await db.eventRSVP.deleteMany({ where: { eventId: id } });
    await db.schoolEvent.delete({ where: { id } });

    return NextResponse.json({ message: 'Event deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
