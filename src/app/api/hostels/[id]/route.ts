import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

async function getHostelOrError(id: string, schoolId: string) {
  const hostel = await db.hostel.findUnique({ where: { id } });
  if (!hostel || hostel.deletedAt) {
    return { error: 'Hostel not found', status: 404 };
  }
  if (hostel.schoolId !== schoolId) {
    return { error: 'Hostel not found in this school', status: 404 };
  }
  return { hostel };
}

// GET /api/hostels/[id] - Get single hostel with rooms and beds
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const result = await getHostelOrError(id, schoolId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const hostel = await db.hostel.findUnique({
      where: { id },
      include: {
        _count: { select: { rooms: true, allocations: { where: { status: 'active' } } } },
        rooms: {
          where: { isActive: true },
          orderBy: { floor: 'asc' },
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
        },
      },
    });

    return NextResponse.json({ data: hostel, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[API] GET /hostels/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch hostel' }, { status: 500 });
  }
}

// PUT /api/hostels/[id] - Update a hostel
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const result = await getHostelOrError(id, schoolId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json();
    const { name, description, gender, capacity, wardenName, wardenPhone, wardenEmail, address, isActive } = body;

    if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'Hostel name cannot be empty' }, { status: 400 });
    }

    if (gender && !['male', 'female', 'mixed'].includes(gender)) {
      return NextResponse.json({ error: 'Gender must be male, female, or mixed' }, { status: 400 });
    }

    if (name && name.trim() !== result.hostel.name) {
      const existing = await db.hostel.findUnique({
        where: { schoolId_name: { schoolId, name: name.trim() } },
      });
      if (existing && existing.id !== id && !existing.deletedAt) {
        return NextResponse.json({ error: 'A hostel with this name already exists' }, { status: 409 });
      }
    }

    const hostel = await db.hostel.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(capacity !== undefined ? { capacity: parseInt(capacity) } : {}),
        ...(wardenName !== undefined ? { wardenName } : {}),
        ...(wardenPhone !== undefined ? { wardenPhone } : {}),
        ...(wardenEmail !== undefined ? { wardenEmail } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(isActive !== undefined ? { isActive: isActive === true || isActive === 'true' } : {}),
      },
    });

    return NextResponse.json({ data: hostel, message: 'Hostel updated successfully' });
  } catch (error) {
    console.error('[API] PUT /hostels/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update hostel' }, { status: 500 });
  }
}

// DELETE /api/hostels/[id] - Soft delete a hostel
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const querySchoolId = new URL(request.url).searchParams.get('schoolId') || '';
    const schoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const result = await getHostelOrError(id, schoolId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const activeAllocations = await db.hostelAllocation.count({
      where: { hostelId: id, status: 'active' },
    });
    if (activeAllocations > 0) {
      return NextResponse.json(
        { error: `Cannot delete hostel with ${activeAllocations} active allocation(s). Vacate all students first.` },
        { status: 409 }
      );
    }

    await db.hostel.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ message: 'Hostel deleted successfully' });
  } catch (error) {
    console.error('[API] DELETE /hostels/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete hostel' }, { status: 500 });
  }
}
