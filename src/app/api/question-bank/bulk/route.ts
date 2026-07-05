import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireFeature } from '@/lib/auth-middleware';

// POST /api/question-bank/bulk
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const featureCheck = await requireFeature(request, 'question_bank');
    if (featureCheck instanceof NextResponse) return featureCheck;

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions array is required' }, { status: 400 });
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText) {
        return NextResponse.json({ error: `Question at index ${i} is missing questionText` }, { status: 400 });
      }
    }

    const targetSchoolId = auth.role === 'SUPER_ADMIN' ? (body.schoolId || auth.schoolId) : auth.schoolId;
    if (!targetSchoolId) {
      return NextResponse.json({ error: 'School context required' }, { status: 403 });
    }

    const data = questions.map((q: Record<string, unknown>) => ({
      schoolId: targetSchoolId,
      type: (q.type as string) || 'MCQ',
      questionText: q.questionText as string,
      options: q.options ? JSON.stringify(q.options) : null,
      correctAnswer: q.correctAnswer !== undefined && q.correctAnswer !== null ? JSON.stringify(q.correctAnswer) : null,
      marks: (q.marks as number) ?? 1,
      explanation: (q.explanation as string) || null,
      mediaUrl: (q.mediaUrl as string) || null,
      difficulty: (q.difficulty as string) || 'intermediate',
      subjectId: (q.subjectId as string) || null,
      classId: (q.classId as string) || null,
      topicId: (q.topicId as string) || null,
      topic: (q.topic as string) || null,
      tags: q.tags ? JSON.stringify(q.tags) : null,
      createdById: auth.userId!,
    }));

    const created = await db.questionBank.createMany({ data });

    return NextResponse.json({ data: created, message: `${created.count} question(s) created` }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
