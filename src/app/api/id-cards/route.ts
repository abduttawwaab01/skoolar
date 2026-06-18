import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const schoolId = searchParams.get('schoolId') || '';
    const personType = searchParams.get('personType') || '';
    const personId = searchParams.get('personId') || '';
    const status = searchParams.get('status') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId
      ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const where: Record<string, unknown> = { schoolId: targetSchoolId };
    if (personType) where.personType = personType;
    if (personId) where.personId = personId;
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      db.iDCard.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: {
          design: { select: { id: true, name: true, orientation: true } },
        },
      }),
      db.iDCard.count({ where: where as any }),
    ]);

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('GET /api/id-cards error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(auth.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { personType, personId, userId, fullName, displayId, schoolId, designId,
      role, department, className, section, gender, dateOfBirth, bloodGroup,
      phone, email, address, house, academicSession } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId
      ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const uuid = crypto.randomUUID();
    const validationToken = crypto.randomUUID();
    const qrCodeData = `skoolar://attendance/scan/${uuid}?token=${validationToken}`;

    const card = await db.iDCard.create({
      data: {
        schoolId: targetSchoolId,
        designId: designId || null,
        personType: personType || 'student',
        personId: personId || '',
        userId: userId || null,
        fullName: fullName || '',
        displayId: displayId || '',
        role: role || null,
        department: department || null,
        className: className || null,
        section: section || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        bloodGroup: bloodGroup || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        house: house || null,
        academicSession: academicSession || null,
        uuid,
        validationToken,
        status: 'active',
        qrCodeData,
        issueDate: new Date(),
      },
    });

    return NextResponse.json({ data: card }, { status: 201 });
  } catch (error) {
    console.error('POST /api/id-cards error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
