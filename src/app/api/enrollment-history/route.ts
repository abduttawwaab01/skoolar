import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 'public, s-maxage=15, stale-while-revalidate=30';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';
    const querySchoolId = searchParams.get('schoolId') || '';

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && querySchoolId
      ? querySchoolId
      : (auth.schoolId || '');
    if (!targetSchoolId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    if (!studentId) {
      return NextResponse.json({ error: 'studentId query param is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { studentId };
    if (targetSchoolId) where.schoolId = targetSchoolId;

    const [data, total] = await Promise.all([
      db.enrollmentHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          fromClass: { select: { id: true, name: true, grade: true } },
          toClass: { select: { id: true, name: true, grade: true } },
          student: {
            select: {
              id: true,
              admissionNo: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
      db.enrollmentHistory.count({ where }),
    ]);

    return NextResponse.json({ data, total }, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, studentId, action, fromClassId, toClassId, fromSchoolName, toSchoolName, reason, notes, performedBy } = body;

    const targetSchoolId = auth.role === 'SUPER_ADMIN' && schoolId ? schoolId : (auth.schoolId || '');
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    if (!studentId || !action) {
      return NextResponse.json({ error: 'studentId and action are required' }, { status: 400 });
    }

    const validActions = ['enrollment', 'transfer_in', 'transfer_out', 'class_change', 'graduation', 'withdrawal', 'reinstatement'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    const record = await db.enrollmentHistory.create({
      data: {
        schoolId: targetSchoolId,
        studentId,
        action,
        fromClassId: fromClassId || null,
        toClassId: toClassId || null,
        fromSchoolName: fromSchoolName || null,
        toSchoolName: toSchoolName || null,
        reason: reason || null,
        notes: notes || null,
        performedBy: performedBy || auth.userId || null,
      },
      include: {
        fromClass: { select: { id: true, name: true, grade: true } },
        toClass: { select: { id: true, name: true, grade: true } },
      },
    });

    return NextResponse.json({ data: record, message: 'Enrollment record created successfully' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
