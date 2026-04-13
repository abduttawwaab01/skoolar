import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (!['SCHOOL_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(auth.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    
    const existing = await db.entranceExam.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }
    if (auth.role !== 'SUPER_ADMIN' && existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: 'questions must be an array' }, { status: 400 });
    }

    // Delete existing questions and replace them
    await db.$transaction([
      db.entranceExamQuestion.deleteMany({
        where: { entranceExamId: id }
      }),
      db.entranceExamQuestion.createMany({
        data: questions.map((q: {
          type?: string; questionText: string; options?: unknown;
          correctAnswer?: unknown; marks?: number; explanation?: string; mediaUrl?: string;
        }, i: number) => ({
          entranceExamId: id,
          type: q.type || 'MCQ',
          questionText: q.questionText,
          options: q.options ? JSON.stringify(q.options) : null,
          correctAnswer: typeof q.correctAnswer === 'object' ? JSON.stringify(q.correctAnswer) : (String(q.correctAnswer || '')),
          marks: q.marks || 1,
          explanation: q.explanation || null,
          mediaUrl: q.mediaUrl || null,
          order: i,
        }))
      })
    ]);

    return NextResponse.json({ message: 'Questions updated successfully' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
