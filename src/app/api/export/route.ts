import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const schoolId = auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 400 });
    }

    let data: Record<string, unknown> = {};

    if (type === 'all' || type === 'students') {
      const students = await db.student.findMany({
        where: { schoolId },
        include: { user: { select: { name: true, email: true, phone: true } } },
      });
      data.students = students;
    }

    if (type === 'all' || type === 'teachers') {
      const teachers = await db.teacher.findMany({
        where: { schoolId },
        include: { user: { select: { name: true, email: true, phone: true } } },
      });
      data.teachers = teachers;
    }

    if (type === 'all' || type === 'results') {
      const results = await db.exam.findMany({
        where: { schoolId },
        select: { id: true, name: true, termId: true, classId: true, createdAt: true },
      });
      data.results = results;
    }

    if (type === 'all' || type === 'classes') {
      const classes = await db.class.findMany({
        where: { schoolId },
      });
      data.classes = classes;
    }

    if (type === 'all' || type === 'subjects') {
      const subjects = await db.subject.findMany({
        where: { schoolId },
      });
      data.subjects = subjects;
    }

    return NextResponse.json({
      data,
      _watermark: 'Skoolar - Odebunmi Tawwāb',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}