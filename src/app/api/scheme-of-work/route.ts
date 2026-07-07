import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = auth.role === 'SUPER_ADMIN' && searchParams.get('schoolId')
      ? searchParams.get('schoolId')
      : (auth.schoolId || '');
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const termId = searchParams.get('termId');
    const academicYearId = searchParams.get('academicYearId');
    const isPublished = searchParams.get('isPublished');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId, deletedAt: null };
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;
    if (termId) where.termId = termId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (isPublished === 'true') where.isPublished = true;
    if (isPublished === 'false') where.isPublished = false;

    const [data, total] = await Promise.all([
      db.schemeOfWork.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { id: true, name: true, code: true } },
          term: { select: { id: true, name: true, order: true } },
          academicYear: { select: { id: true, name: true } },
          _count: { select: { entries: true } },
        },
      }),
      db.schemeOfWork.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.role || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId: rawSchoolId, academicYearId, termId, classId, subjectId, title, description } = body;

    const schoolId = auth.role === 'SUPER_ADMIN' && rawSchoolId
      ? rawSchoolId
      : (auth.schoolId || '');
    if (!schoolId || !academicYearId || !termId || !classId || !subjectId) {
      return NextResponse.json({ error: 'schoolId, academicYearId, termId, classId, and subjectId are required' }, { status: 400 });
    }

    const existing = await db.schemeOfWork.findUnique({
      where: { schoolId_termId_subjectId_classId: { schoolId, termId, subjectId, classId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'A scheme of work already exists for this subject, class, and term' }, { status: 409 });
    }

    // Auto-calculate weeks from term duration
    const term = await db.term.findUnique({ where: { id: termId } });
    if (!term) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 });
    }

    const diffDays = Math.ceil((term.endDate.getTime() - term.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(1, Math.ceil(diffDays / 7));

    const scheme = await db.schemeOfWork.create({
      data: {
        schoolId,
        academicYearId,
        termId,
        classId,
        subjectId,
        title: title || null,
        description: description || null,
        createdBy: auth.id!,
        entries: {
          create: Array.from({ length: totalWeeks }, (_, i) => ({
            weekNumber: i + 1,
            topic: '',
            status: 'pending',
          })),
        },
      },
      include: {
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
        term: { select: { id: true, name: true, order: true } },
        academicYear: { select: { id: true, name: true } },
        entries: { orderBy: { weekNumber: 'asc' } },
      },
    });

    return NextResponse.json({ data: scheme, message: 'Scheme of work created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
