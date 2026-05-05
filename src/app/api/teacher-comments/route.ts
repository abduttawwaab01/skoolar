import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

// GET /api/teacher-comments?studentId=xxx
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId') || '';
    const termId = searchParams.get('termId') || '';

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { studentId };
    if (termId) where.termId = termId;

    const comments = await db.teacherComment.findMany({
      where,
      select: {
        id: true,
        category: true,
        comment: true,
        isPublished: true,
        createdAt: true,
        teacher: {
          select: { user: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: comments,
      total: comments.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/teacher-comments - Create or update teacher comment
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, termId, category, comment, isPublished } = body;

    if (!studentId || !termId || !category || !comment) {
      return NextResponse.json({ error: 'studentId, termId, category, and comment are required' }, { status: 400 });
    }

    let teacherId: string | undefined;
    if (auth.role === 'TEACHER') {
      const teacher = await db.teacher.findFirst({ where: { userId: auth.userId } });
      teacherId = teacher?.id;
    }

    const existing = await db.teacherComment.findFirst({
      where: { studentId, termId, category },
    });

    let result;
    if (existing) {
      result = await db.teacherComment.update({
        where: { id: existing.id },
        data: { comment, isPublished: isPublished ?? existing.isPublished },
      });
    } else {
      const finalTeacherId = teacherId || auth.userId || '';
      if (!finalTeacherId) {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 400 });
      }
      result = await db.teacherComment.create({
        data: {
          schoolId: auth.schoolId || '',
          teacherId: finalTeacherId,
          studentId,
          termId,
          category,
          comment,
          isPublished: isPublished ?? false,
        },
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}