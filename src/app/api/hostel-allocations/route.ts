import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// GET /api/hostel-allocations - List all allocations
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const querySchoolId = searchParams.get('schoolId') || '';
    const hostelId = searchParams.get('hostelId') || '';
    const roomId = searchParams.get('roomId') || '';
    const status = searchParams.get('status') || '';
    const studentId = searchParams.get('studentId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (hostelId) where.hostelId = hostelId;
    if (roomId) where.roomId = roomId;
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;

    const [allocations, total] = await Promise.all([
      db.hostelAllocation.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { id: true, name: true, avatar: true } },
            },
          },
          hostel: { select: { id: true, name: true } },
          room: { select: { id: true, roomNumber: true, floor: true } },
          bed: { select: { id: true, bedNumber: true } },
        },
      }),
      db.hostelAllocation.count({ where: where as any }),
    ]);

    return NextResponse.json({
      data: allocations,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] GET /hostel-allocations error:', error);
    return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 });
  }
}

// POST /api/hostel-allocations - Allocate a student to a bed
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, hostelId, roomId, bedId, startDate, notes } = body;

    if (!studentId || !hostelId || !roomId || !bedId) {
      return NextResponse.json({ error: 'studentId, hostelId, roomId, and bedId are required' }, { status: 400 });
    }

    // Validate student belongs to this school
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true, isActive: true },
    });
    if (!student || student.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
    }
    if (!student.isActive) {
      return NextResponse.json({ error: 'Student is not active' }, { status: 400 });
    }

    // Validate hostel/school ownership
    const hostel = await db.hostel.findUnique({
      where: { id: hostelId },
      select: { id: true, schoolId: true, isActive: true, deletedAt: true },
    });
    if (!hostel || hostel.schoolId !== schoolId || hostel.deletedAt || !hostel.isActive) {
      return NextResponse.json({ error: 'Hostel not found or inactive' }, { status: 404 });
    }

    // Validate room belongs to hostel
    const room = await db.hostelRoom.findUnique({
      where: { id: roomId },
      select: { id: true, hostelId: true, isActive: true },
    });
    if (!room || room.hostelId !== hostelId || !room.isActive) {
      return NextResponse.json({ error: 'Room not found or inactive' }, { status: 404 });
    }

    // Validate bed belongs to room and is available
    const bed = await db.hostelBed.findUnique({
      where: { id: bedId },
      include: { allocation: { where: { status: 'active' }, select: { id: true } } },
    });
    if (!bed || bed.roomId !== roomId) {
      return NextResponse.json({ error: 'Bed not found in this room' }, { status: 404 });
    }
    if (bed.isOccupied || bed.allocation) {
      return NextResponse.json({ error: 'This bed is already occupied' }, { status: 409 });
    }

    // Check student doesn't already have an active allocation
    const existingAllocation = await db.hostelAllocation.findFirst({
      where: { studentId, status: 'active' },
    });
    if (existingAllocation) {
      return NextResponse.json(
        { error: 'Student already has an active allocation. Please vacate it first.' },
        { status: 409 }
      );
    }

    const allocation = await db.hostelAllocation.create({
      data: {
        schoolId,
        studentId,
        hostelId,
        roomId,
        bedId,
        startDate: startDate ? new Date(startDate) : new Date(),
        notes: notes || null,
        allocatedBy: auth.userId,
        status: 'active',
      },
    });

    await db.hostelBed.update({
      where: { id: bedId },
      data: { isOccupied: true },
    });

    const fullAllocation = await db.hostelAllocation.findUnique({
      where: { id: allocation.id },
      include: {
        student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } },
        hostel: { select: { name: true } },
        room: { select: { roomNumber: true } },
        bed: { select: { bedNumber: true } },
      },
    });

    return NextResponse.json({ data: fullAllocation, message: 'Student allocated successfully' }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /hostel-allocations error:', error);
    return NextResponse.json({ error: 'Failed to create allocation' }, { status: 500 });
  }
}

// PUT /api/hostel-allocations - Transfer or vacate an allocation
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const body = await request.json();
    const { allocationId, action, newBedId, endDate, notes } = body;

    if (!allocationId || !action) {
      return NextResponse.json({ error: 'allocationId and action are required' }, { status: 400 });
    }

    if (!['transfer', 'vacate'].includes(action)) {
      return NextResponse.json({ error: 'Action must be transfer or vacate' }, { status: 400 });
    }

    const allocation = await db.hostelAllocation.findUnique({
      where: { id: allocationId },
      include: { bed: { select: { id: true } } },
    });

    if (!allocation || allocation.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    if (allocation.status !== 'active') {
      return NextResponse.json({ error: 'Allocation is not active' }, { status: 400 });
    }

    if (action === 'transfer') {
      if (!newBedId) {
        return NextResponse.json({ error: 'newBedId is required for transfer' }, { status: 400 });
      }

      const newBed = await db.hostelBed.findUnique({
        where: { id: newBedId },
        include: { allocation: { where: { status: 'active' }, select: { id: true } } },
      });
      if (!newBed) {
        return NextResponse.json({ error: 'New bed not found' }, { status: 404 });
      }
      if (newBed.isOccupied || newBed.allocation) {
        return NextResponse.json({ error: 'New bed is already occupied' }, { status: 409 });
      }

      const newRoom = await db.hostelRoom.findUnique({
        where: { id: newBed.roomId },
        select: { id: true, hostelId: true, isActive: true },
      });
      if (!newRoom || !newRoom.isActive) {
        return NextResponse.json({ error: 'New bed room is not active' }, { status: 400 });
      }

      // Vacate old bed
      await db.hostelBed.update({
        where: { id: allocation.bedId },
        data: { isOccupied: false },
      });

      // Occupy new bed
      await db.hostelBed.update({
        where: { id: newBedId },
        data: { isOccupied: true },
      });

      // Update allocation
      const updated = await db.hostelAllocation.update({
        where: { id: allocationId },
        data: {
          roomId: newBed.roomId,
          bedId: newBedId,
          hostelId: newRoom.hostelId,
          notes: notes || allocation.notes,
        },
        include: {
          student: { select: { id: true, admissionNo: true, user: { select: { name: true } } } },
          hostel: { select: { name: true } },
          room: { select: { roomNumber: true } },
          bed: { select: { bedNumber: true } },
        },
      });

      return NextResponse.json({ data: updated, message: 'Student transferred successfully' });
    }

    // Vacate - delete the allocation record to free the bed for reuse
    // (bedId is @unique, so we must delete rather than soft-update status)
    await db.hostelBed.update({
      where: { id: allocation.bedId },
      data: { isOccupied: false },
    });

    await db.hostelAllocation.delete({
      where: { id: allocationId },
    });

    return NextResponse.json({ message: 'Student vacated successfully', data: { id: allocationId } });
  } catch (error) {
    console.error('[API] PUT /hostel-allocations error:', error);
    return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 });
  }
}
