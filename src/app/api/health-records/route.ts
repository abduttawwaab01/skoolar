import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const studentId = searchParams.get('studentId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const where: Record<string, unknown> = { schoolId: targetSchoolId };
    if (studentId) where.studentId = studentId;

    const records = await db.healthRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { name: true } } },
    });

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error('GET /api/health-records error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, bloodType, allergies, conditions, vaccinations, height, weight, vision, lastCheckup, notes, schoolId: bodySchoolId } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !studentId) {
      return NextResponse.json({ error: 'schoolId and studentId are required' }, { status: 400 });
    }

    const record = await db.healthRecord.create({
      data: {
        schoolId: targetSchoolId,
        studentId,
        bloodType: bloodType || null,
        allergies: allergies || null,
        conditions: conditions || null,
        vaccinations: vaccinations || null,
        height: height ?? null,
        weight: weight ?? null,
        vision: vision || null,
        lastCheckup: lastCheckup ? new Date(lastCheckup) : null,
        notes: notes || null,
        recordedBy: auth.userId || null,
      },
    });

    return NextResponse.json({ data: record, message: 'Health record created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/health-records error:', error);
    return NextResponse.json({ error: 'Failed to create health record' }, { status: 500 });
  }
}
