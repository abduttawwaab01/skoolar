import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { resolveTeacherId } from '@/lib/api-helpers';

function canWrite(role: string | undefined): boolean {
  return !!role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(role);
}

function canDelete(role: string | undefined): boolean {
  return !!role && ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'].includes(role);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const plan = await db.lessonPlan.findFirst({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && plan.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'You are not authorized to view this lesson plan' }, { status: 403 });
    }

    return NextResponse.json({ data: plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!canWrite(auth.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { subjectId, classId, topic, content, objectives, activities, resources, status, quiz, masteryThresholds } = body;

    const existing = await db.lessonPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'You are not authorized to update this lesson plan' }, { status: 403 });
    }

    // Teachers can only update their own lesson plans
    if (auth.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(auth.userId || '');
      if (!teacherId || existing.teacherId !== teacherId) {
        return NextResponse.json({ error: 'You can only update your own lesson plans' }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (subjectId !== undefined) updateData.subjectId = subjectId;
    if (classId !== undefined) updateData.classId = classId;
    if (topic !== undefined) updateData.topic = topic;
    if (content !== undefined) updateData.content = content;
    if (objectives !== undefined) updateData.objectives = objectives;
    if (activities !== undefined) updateData.activities = activities;
    if (resources !== undefined) updateData.resources = resources;
    if (quiz !== undefined) updateData.quiz = quiz;
    if (masteryThresholds !== undefined) updateData.masteryThresholds = masteryThresholds;
    if (status !== undefined) updateData.status = status;

    const plan = await db.lessonPlan.update({
      where: { id },
      data: updateData,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
      },
    });

    return NextResponse.json({ data: plan, message: 'Lesson plan updated' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!canDelete(auth.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.lessonPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'You are not authorized to delete this lesson plan' }, { status: 403 });
    }

    // Teachers can only delete their own lesson plans
    if (auth.role === 'TEACHER') {
      const teacherId = await resolveTeacherId(auth.userId || '');
      if (!teacherId || existing.teacherId !== teacherId) {
        return NextResponse.json({ error: 'You can only delete your own lesson plans' }, { status: 403 });
      }
    }

    await db.lessonPlan.delete({ where: { id } });

    return NextResponse.json({ message: 'Lesson plan deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
