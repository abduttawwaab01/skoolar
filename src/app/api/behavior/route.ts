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
    const type = searchParams.get('type') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const where: Record<string, unknown> = { schoolId: targetSchoolId };
    if (studentId) where.studentId = studentId;
    if (type) where.type = type;

    const logs = await db.behaviorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { student: { include: { user: { select: { name: true } } } } },
    });

    return NextResponse.json({ data: logs });
  } catch (error) {
    console.error('GET /api/behavior error:', error);
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
    const { studentId, type, category, points, description, schoolId: bodySchoolId } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !studentId || !type || !category || !description) {
      return NextResponse.json({ error: 'studentId, type, category, and description are required' }, { status: 400 });
    }

    const log = await db.behaviorLog.create({
      data: {
        schoolId: targetSchoolId,
        studentId,
        type,
        category,
        points: points ?? 0,
        description,
        reportedBy: auth.userId || null,
      },
    });

    return NextResponse.json({ data: log, message: 'Behavior log created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/behavior error:', error);
    return NextResponse.json({ error: 'Failed to create behavior log' }, { status: 500 });
  }
}
