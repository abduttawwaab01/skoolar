import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireFeature } from '@/lib/auth-middleware';

// GET /api/question-bank/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const { id } = await params;

    const question = await db.questionBank.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        topicRel: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...question,
        options: question.options ? safeJsonParse(question.options) : null,
        correctAnswer: question.correctAnswer ? safeJsonParse(question.correctAnswer) : null,
        tags: question.tags ? safeJsonParse(question.tags) : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/question-bank/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.questionBank.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const fields = ['type', 'questionText', 'explanation', 'mediaUrl', 'difficulty', 'subjectId', 'classId', 'topicId', 'topic', 'marks'];
    for (const field of fields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.options !== undefined) updateData.options = body.options !== null ? JSON.stringify(body.options) : null;
    if (body.correctAnswer !== undefined) updateData.correctAnswer = body.correctAnswer !== null ? JSON.stringify(body.correctAnswer) : null;
    if (body.tags !== undefined) updateData.tags = body.tags !== null ? JSON.stringify(body.tags) : null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await db.questionBank.update({ where: { id }, data: updateData });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/question-bank/[id] - Permanent delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const { id } = await params;

    const existing = await db.questionBank.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.questionBank.delete({ where: { id } });

    return NextResponse.json({ message: 'Question deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeJsonParse(val: string): unknown {
  try { return JSON.parse(val); } catch { return val; }
}
