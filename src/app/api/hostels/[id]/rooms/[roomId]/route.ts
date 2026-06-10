import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

async function getRoomOrError(roomId: string, schoolId: string) {
  const room = await db.hostelRoom.findUnique({
    where: { id: roomId },
    include: { hostel: { select: { id: true, schoolId: true, name: true } } },
  });
  if (!room) return { error: 'Room not found', status: 404 };
  if (room.hostel.schoolId !== schoolId) return { error: 'Room not found in this school', status: 404 };
  return { room };
}

// GET /api/hostels/[id]/rooms/[roomId] - Get single room with bed details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { roomId } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const result = await getRoomOrError(roomId, schoolId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const room = await db.hostelRoom.findUnique({
      where: { id: roomId },
      include: {
        hostel: { select: { id: true, name: true, schoolId: true } },
        beds: {
          orderBy: { bedNumber: 'asc' },
          include: {
            allocation: {
              where: { status: 'active' },
              select: {
                id: true,
                studentId: true,
                startDate: true,
                student: {
                  select: {
                    id: true,
                    admissionNo: true,
                    user: { select: { id: true, name: true, avatar: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: room, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API] GET /hostels/[id]/rooms/[roomId] error:', error);
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
  }
}

// PUT /api/hostels/[id]/rooms/[roomId] - Update a room
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { roomId } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const result = await getRoomOrError(roomId, schoolId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json();
    const { roomNumber, floor, capacity, isActive } = body;
    const { hostel } = result.room;

    if (roomNumber !== undefined && (!roomNumber || typeof roomNumber !== 'string' || !roomNumber.trim())) {
      return NextResponse.json({ error: 'Room number cannot be empty' }, { status: 400 });
    }

    if (roomNumber && roomNumber.trim() !== result.room.roomNumber) {
      const existing = await db.hostelRoom.findUnique({
        where: { hostelId_roomNumber: { hostelId: hostel.id, roomNumber: roomNumber.trim() } },
      });
      if (existing && existing.id !== roomId && existing.isActive) {
        return NextResponse.json({ error: 'Room number already exists in this hostel' }, { status: 409 });
      }
    }

    const room = await db.hostelRoom.update({
      where: { id: roomId },
      data: {
        ...(roomNumber !== undefined ? { roomNumber: roomNumber.trim() } : {}),
        ...(floor !== undefined ? { floor: parseInt(floor) } : {}),
        ...(capacity !== undefined ? { capacity: parseInt(capacity) } : {}),
        ...(isActive !== undefined ? { isActive: isActive === true || isActive === 'true' } : {}),
      },
    });

    return NextResponse.json({ data: room, message: 'Room updated successfully' });
  } catch (error) {
    console.error('[API] PUT /hostels/[id]/rooms/[roomId] error:', error);
    return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
  }
}

// DELETE /api/hostels/[id]/rooms/[roomId] - Soft delete a room
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { roomId } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const result = await getRoomOrError(roomId, schoolId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const activeAllocations = await db.hostelAllocation.count({
      where: { roomId, status: 'active' },
    });
    if (activeAllocations > 0) {
      return NextResponse.json(
        { error: `Cannot delete room with ${activeAllocations} active allocation(s). Vacate all students first.` },
        { status: 409 }
      );
    }

    await db.hostelRoom.update({
      where: { id: roomId },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('[API] DELETE /hostels/[id]/rooms/[roomId] error:', error);
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
