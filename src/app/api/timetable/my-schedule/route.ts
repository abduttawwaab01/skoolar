import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const schoolId = auth.schoolId || '';
    const userId = auth.userId || auth.id || '';
    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId') || '';
    const weekStart = searchParams.get('weekStart') || '';

    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findUnique({ where: { userId } });
      if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

      const where: Record<string, unknown> = {
        teacherId: teacher.id,
        isCancelled: false,
        timetable: { schoolId, deletedAt: null, isPublished: true },
      };
      if (termId) where.termId = termId;

      const slots = await db.timetableSlot.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { id: true, name: true, code: true } },
          timetable: { select: { id: true, name: true } },
          schemeOfWorkEntry: {
            select: { id: true, weekNumber: true, topic: true, subTopic: true, status: true },
          },
        },
      });

      const timetables = await db.timetable.findMany({
        where: { schoolId, deletedAt: null, isPublished: true },
        select: { id: true, name: true, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ data: slots, timetables, role: 'TEACHER', teacherId: teacher.id });
    }

    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({ where: { userId }, select: { id: true, classId: true } });
      if (!student || !student.classId) {
        return NextResponse.json({ error: 'Student profile or class assignment not found' }, { status: 404 });
      }

      const where: Record<string, unknown> = {
        classId: student.classId,
        isCancelled: false,
        timetable: { schoolId, deletedAt: null, isPublished: true },
      };
      if (termId) where.termId = termId;

      const slots = await db.timetableSlot.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, user: { select: { name: true } } } },
          timetable: { select: { id: true, name: true } },
          schemeOfWorkEntry: {
            select: { id: true, weekNumber: true, topic: true, status: true },
          },
        },
      });

      return NextResponse.json({ data: slots, role: 'STUDENT', classId: student.classId });
    }

    if (auth.role === 'PARENT') {
      const parent = await db.parent.findUnique({ where: { userId } });
      if (!parent) return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 });

      const relationships = await db.studentParent.findMany({
        where: { parentId: parent.id },
        include: {
          student: {
            select: {
              id: true, classId: true,
              user: { select: { name: true } },
              class: { select: { id: true, name: true } },
            },
          },
        },
      });

      const children = relationships.filter(r => r.student.classId);

      const allSlots = await Promise.all(
        children.map(async (r) => {
          const where: Record<string, unknown> = {
            classId: r.student.classId!,
            isCancelled: false,
            timetable: { schoolId, deletedAt: null, isPublished: true },
          };
          if (termId) where.termId = termId;

          const slots = await db.timetableSlot.findMany({
            where,
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            include: {
              subject: { select: { id: true, name: true, code: true } },
              teacher: { select: { id: true, user: { select: { name: true } } } },
              timetable: { select: { id: true, name: true } },
            },
          });

          return { student: r.student, slots };
        })
      );

      return NextResponse.json({
        data: allSlots,
        role: 'PARENT',
        children: children.map(r => r.student),
      });
    }

    if (auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN' || auth.role === 'DIRECTOR') {
      const where: Record<string, unknown> = {
        timetable: { schoolId, deletedAt: null, isPublished: true },
      };
      if (termId) where.termId = termId;

      if (weekStart) {
        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 7);
        where.timetable = {
          ...(where.timetable as Record<string, unknown>),
          weekStartDate: { lte: weekEndDate },
          weekEndDate: { gte: weekStartDate },
        };
      }

      const slots = await db.timetableSlot.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        include: {
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, user: { select: { name: true } } } },
          timetable: { select: { id: true, name: true, isPublished: true } },
        },
      });

      return NextResponse.json({ data: slots, role: auth.role });
    }

    return NextResponse.json({ error: 'Role not supported for schedule view' }, { status: 403 });
  } catch (error) {
    console.error('My schedule GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
