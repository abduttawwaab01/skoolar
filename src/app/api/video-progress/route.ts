import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const lessonIds = searchParams.get('lessonIds');
    const studentId = searchParams.get('studentId');

    if (!lessonId && !lessonIds) {
      return NextResponse.json({ error: 'lessonId or lessonIds is required' }, { status: 400 });
    }

    let targetStudentId = studentId;
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { id: true }
      });
      if (!student) {
        return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
      }
      targetStudentId = student.id;
    } else {
      if (!targetStudentId) {
        return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
      }
      const student = await db.student.findUnique({
        where: { id: targetStudentId },
        select: { schoolId: true }
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      if (auth.role !== 'SUPER_ADMIN' && student.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Unauthorized to access progress for this student' }, { status: 403 });
      }
    }

    if (!targetStudentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    if (lessonIds) {
      const ids = lessonIds.split(',').filter(Boolean);
      const progressRecords = await db.studentVideoProgress.findMany({
        where: {
          studentId: targetStudentId,
          lessonId: { in: ids },
        },
      });
      const progressMap = Object.fromEntries(
        ids.map(id => [id, progressRecords.find(p => p.lessonId === id) || { progress: 0, completed: false, lessonId: id }])
      );
      return NextResponse.json({ data: progressMap });
    }

    const progress = await db.studentVideoProgress.findUnique({
      where: { studentId_lessonId: { studentId: targetStudentId, lessonId: lessonId! } },
    });

    return NextResponse.json({ data: progress || { progress: 0, completed: false } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { lessonId, progress, completed } = body;
    const studentId = body.studentId;

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    let targetStudentId = studentId;
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { id: true }
      });
      if (!student) {
        return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
      }
      targetStudentId = student.id;
    } else {
      if (!targetStudentId) {
        return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
      }
      const student = await db.student.findUnique({
        where: { id: targetStudentId },
        select: { schoolId: true }
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      if (auth.role !== 'SUPER_ADMIN' && student.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Unauthorized to modify progress for this student' }, { status: 403 });
      }
    }

    const data = await db.studentVideoProgress.upsert({
      where: { studentId_lessonId: { studentId: targetStudentId, lessonId } },
      create: {
        studentId: targetStudentId,
        lessonId,
        progress: progress ?? 0,
        completed: completed ?? false,
      },
      update: {
        progress: progress ?? 0,
        completed: completed ?? false,
        lastWatchedAt: new Date(),
      },
    });

    return NextResponse.json({ data, message: 'Progress updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { lessonId, completed } = body;
    const studentId = body.studentId;

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    let targetStudentId = studentId;
    if (auth.role === 'STUDENT') {
      const student = await db.student.findUnique({
        where: { userId: auth.userId },
        select: { id: true }
      });
      if (!student) {
        return NextResponse.json({ error: 'Student record not found' }, { status: 404 });
      }
      targetStudentId = student.id;
    } else {
      if (!targetStudentId) {
        return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
      }
      const student = await db.student.findUnique({
        where: { id: targetStudentId },
        select: { schoolId: true }
      });
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      if (auth.role !== 'SUPER_ADMIN' && student.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Unauthorized to modify progress for this student' }, { status: 403 });
      }
    }

    const data = await db.studentVideoProgress.update({
      where: { studentId_lessonId: { studentId: targetStudentId, lessonId } },
      data: { completed: completed ?? true, lastWatchedAt: new Date() },
    });

    return NextResponse.json({ data, message: 'Progress updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
