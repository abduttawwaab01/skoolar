import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { DEFAULT_THRESHOLDS } from '@/lib/report-card-utils/grade-calculator';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const scales = await db.gradeScale.findMany({
      where: { schoolId: targetSchoolId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: scales, defaults: DEFAULT_THRESHOLDS });
  } catch (error) {
    console.error('GET /api/grade-scales error:', error);
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
    const { name, thresholds, schoolId: bodySchoolId, description } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !name || !thresholds) {
      return NextResponse.json({ error: 'schoolId, name, and thresholds are required' }, { status: 400 });
    }

    const scale = await db.gradeScale.create({
      data: { schoolId: targetSchoolId, name, thresholds: JSON.stringify(thresholds) },
    });

    return NextResponse.json({ data: scale, message: 'Grade scale created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/grade-scales error:', error);
    return NextResponse.json({ error: 'Failed to create grade scale' }, { status: 500 });
  }
}
