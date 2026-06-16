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

    const achievements = await db.achievement.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { student: { include: { user: { select: { name: true } } } } },
    });

    return NextResponse.json({ data: achievements });
  } catch (error) {
    console.error('GET /api/achievements error:', error);
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
    const { studentId, title, description, type, date, badgeIcon, schoolId: bodySchoolId } = body;
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !studentId || !title) {
      return NextResponse.json({ error: 'studentId and title are required' }, { status: 400 });
    }

    const achievement = await db.achievement.create({
      data: {
        schoolId: targetSchoolId,
        studentId,
        title,
        description: description || null,
        type: type || 'academic',
        date: date ? new Date(date) : null,
        badgeIcon: badgeIcon || null,
      },
    });

    return NextResponse.json({ data: achievement, message: 'Achievement created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/achievements error:', error);
    return NextResponse.json({ error: 'Failed to create achievement' }, { status: 500 });
  }
}
