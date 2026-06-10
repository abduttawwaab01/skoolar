import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// GET /api/hostels - List hostels with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const querySchoolId = searchParams.get('schoolId') || '';
    const isActive = searchParams.get('isActive');
    const gender = searchParams.get('gender') || '';
    const search = searchParams.get('search') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    where.deletedAt = null;
    if (targetSchoolId) where.schoolId = targetSchoolId;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (gender) where.gender = gender;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { wardenName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [hostels, total] = await Promise.all([
      db.hostel.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { rooms: true, allocations: { where: { status: 'active' } } },
          },
          rooms: {
            where: { isActive: true },
            select: {
              id: true,
              roomNumber: true,
              floor: true,
              capacity: true,
              _count: { select: { beds: true } },
            },
          },
        },
      }),
      db.hostel.count({ where: where as any }),
    ]);

    return NextResponse.json({
      data: hostels,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] GET /hostels error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hostels', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// POST /api/hostels - Create a new hostel
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const schoolId = auth.role === 'SUPER_ADMIN'
      ? (new URL(request.url).searchParams.get('schoolId') || '')
      : (auth.schoolId || '');
    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, gender, capacity, wardenName, wardenPhone, wardenEmail, address } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Hostel name is required' }, { status: 400 });
    }

    if (gender && !['male', 'female', 'mixed'].includes(gender)) {
      return NextResponse.json({ error: 'Gender must be male, female, or mixed' }, { status: 400 });
    }

    const existing = await db.hostel.findUnique({
      where: { schoolId_name: { schoolId, name: name.trim() } },
    });
    if (existing && !existing.deletedAt) {
      return NextResponse.json({ error: 'A hostel with this name already exists in this school' }, { status: 409 });
    }

    const hostel = await db.hostel.create({
      data: {
        schoolId,
        name: name.trim(),
        description: description || null,
        gender: gender || 'mixed',
        capacity: capacity ? parseInt(capacity) : 50,
        wardenName: wardenName || null,
        wardenPhone: wardenPhone || null,
        wardenEmail: wardenEmail || null,
        address: address || null,
      },
    });

    return NextResponse.json({ data: hostel, message: 'Hostel created successfully' }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /hostels error:', error);
    return NextResponse.json(
      { error: 'Failed to create hostel', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
