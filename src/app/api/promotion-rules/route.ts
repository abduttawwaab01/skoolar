import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get('schoolId') || '';
    const queryClassId = searchParams.get('classId') || '';
    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId ? querySchoolId : (auth.schoolId || '');
    if (!targetSchoolId) return NextResponse.json({ error: 'School context required' }, { status: 403 });

    const where: Record<string, unknown> = { schoolId: targetSchoolId };
    if (queryClassId) where.classId = queryClassId;

    const rules = await db.promotionRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: rules });
  } catch (error) {
    console.error('GET /api/promotion-rules error:', error);
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
    const { name, rules, classId, isActive, schoolId: bodySchoolId } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && bodySchoolId ? bodySchoolId : (auth.schoolId || '');
    if (!targetSchoolId || !name || !rules) {
      return NextResponse.json({ error: 'schoolId, name, and rules are required' }, { status: 400 });
    }

    const rule = await db.promotionRule.create({
      data: {
        schoolId: targetSchoolId,
        name,
        rules: typeof rules === 'string' ? rules : JSON.stringify(rules),
        classId: classId || null,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ data: rule, message: 'Promotion rule created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/promotion-rules error:', error);
    return NextResponse.json({ error: 'Failed to create promotion rule' }, { status: 500 });
  }
}
