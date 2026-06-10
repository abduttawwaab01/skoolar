import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// GET /api/hostels/[id]/rooms - List rooms for a hostel
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id: hostelId } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const hostel = await db.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel || hostel.deletedAt || hostel.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    const rooms = await db.hostelRoom.findMany({
      where: { hostelId, isActive: true },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
      include: {
        _count: { select: { beds: true } },
        beds: {
          orderBy: { bedNumber: 'asc' },
          include: {
            allocation: {
              where: { status: 'active' },
              select: {
                id: true,
                studentId: true,
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

    return NextResponse.json({ data: rooms, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API] GET /hostels/[id]/rooms error:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

// POST /api/hostels/[id]/rooms - Create a new room with auto-generated beds
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: hostelId } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const hostel = await db.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel || hostel.deletedAt || hostel.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 });
    }

    const body = await request.json();
    const { roomNumber, floor, capacity } = body;

    if (!roomNumber || typeof roomNumber !== 'string' || !roomNumber.trim()) {
      return NextResponse.json({ error: 'Room number is required' }, { status: 400 });
    }

    const existingRoom = await db.hostelRoom.findUnique({
      where: { hostelId_roomNumber: { hostelId, roomNumber: roomNumber.trim() } },
    });
    if (existingRoom && existingRoom.isActive) {
      return NextResponse.json({ error: 'Room number already exists in this hostel' }, { status: 409 });
    }

    const roomCapacity = capacity ? Math.max(1, parseInt(capacity)) : 4;

    const room = await db.hostelRoom.create({
      data: {
        hostelId,
        roomNumber: roomNumber.trim(),
        floor: floor ? parseInt(floor) : 1,
        capacity: roomCapacity,
        beds: {
          create: Array.from({ length: roomCapacity }, (_, i) => ({
            bedNumber: `${i + 1}`,
          })),
        },
      },
      include: {
        beds: { orderBy: { bedNumber: 'asc' } },
      },
    });

    return NextResponse.json({ data: room, message: 'Room created successfully' }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /hostels/[id]/rooms error:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
