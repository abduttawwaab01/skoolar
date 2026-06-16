import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const routes = await db.transportRoute.findMany({
      where: { schoolId: targetSchoolId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: routes });
  } catch (error) {
    console.error('GET /api/transport-routes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, driverName, driverPhone, vehicleNo, capacity, stops, schoolId: bodySchoolId } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !name) {
      return NextResponse.json({ error: 'schoolId and name are required' }, { status: 400 });
    }

    const route = await db.transportRoute.create({
      data: {
        schoolId: targetSchoolId,
        name,
        description: description || null,
        driverName: driverName || null,
        driverPhone: driverPhone || null,
        vehicleNo: vehicleNo || null,
        capacity: capacity ?? 40,
        stops: stops || null,
      },
    });

    return NextResponse.json({ data: route, message: 'Transport route created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/transport-routes error:', error);
    return NextResponse.json({ error: 'Failed to create transport route' }, { status: 500 });
  }
}
