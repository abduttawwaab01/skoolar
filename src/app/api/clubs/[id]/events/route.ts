import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole, errorResponse, successResponse } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER',
  ]);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const club = await db.club.findUnique({ where: { id } });
    if (!club) return errorResponse('Club not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && club.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const events = await db.clubEvent.findMany({
      where: { clubId: id, isActive: true },
      orderBy: { eventDate: 'desc' },
    });

    return successResponse(events);
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const authResult = await requireAuthAndRole(request, [
    'SUPER_ADMIN', 'SCHOOL_ADMIN',
  ]);
  if (!authResult.valid) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await request.json();
    const { title, description, eventDate, location } = body;

    if (!title || !eventDate) {
      return errorResponse('title and eventDate are required', 400);
    }

    const club = await db.club.findUnique({ where: { id } });
    if (!club) return errorResponse('Club not found', 404);
    if (auth.role !== 'SUPER_ADMIN' && club.schoolId !== auth.schoolId) {
      return errorResponse('Access denied', 403);
    }

    const event = await db.clubEvent.create({
      data: {
        clubId: id,
        schoolId: club.schoolId,
        title,
        description: description || null,
        eventDate: new Date(eventDate),
        location: location || null,
      },
    });

    return successResponse(event, 'Event created successfully', 201);
  } catch (error: unknown) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
