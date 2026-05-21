import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveTeacherId } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };
    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (status) where.status = status;

    // STUDENT role: only see lesson plans for their class
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { classId: true },
      });
      if (student?.classId) {
        where.classId = student.classId;
      }
    }

    // TEACHER role: only see lesson plans for their classes
    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({
        where: { userId: auth.userId },
        select: {
          id: true,
          classes: { select: { id: true } },
          classSubjects: { select: { classId: true } },
        },
      });
      if (teacher) {
        const teacherClassIds = new Set<string>();
        teacher.classes.forEach(c => teacherClassIds.add(c.id));
        teacher.classSubjects.forEach(cs => teacherClassIds.add(cs.classId));
        if (teacherClassIds.size > 0) {
          where.OR = [
            { teacherId: teacher.id },
            { classId: { in: Array.from(teacherClassIds) } },
          ];
        } else {
          where.teacherId = teacher.id;
        }
      }
    }

    const [data, total] = await Promise.all([
      db.lessonPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true, section: true } },
        },
      }),
      db.lessonPlan.count({ where }),
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
    const { schoolId: rawSchoolId, subjectId, classId, topic, objectives, activities, resources, status, quiz } = body;

    const schoolId = rawSchoolId || auth.schoolId;
    if (!schoolId || !topic) {
      return NextResponse.json({ error: 'schoolId and topic are required' }, { status: 400 });
    }

    // Resolve teacher ID (auth.id = User.id, but teacherId references Teacher.id)
    let teacherId = auth.id!;
    if (auth.role === 'TEACHER') {
      const resolved = await resolveTeacherId(auth.userId || '');
      if (resolved) teacherId = resolved;
    }

    const plan = await db.lessonPlan.create({
      data: {
        schoolId,
        subjectId: subjectId || null,
        classId: classId || null,
        teacherId,
        topic,
        objectives: objectives || null,
        activities: activities || null,
        resources: resources || null,
        quiz: quiz || null,
        status: status || 'draft',
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
      },
    });

    return NextResponse.json({ data: plan, message: 'Lesson plan created' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
