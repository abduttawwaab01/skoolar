import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AIHomeworkAssignment } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'TEACHER' && auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only teachers and admins can generate homework' }, { status: 403 });
    }

    const body = await request.json();
    const schoolId = (auth.role === 'SUPER_ADMIN' && body.schoolId) ? body.schoolId : auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const { subjectId, classId, topic, difficulty, dueInDays, additionalInstructions } = body;

    if (!subjectId || !classId || !topic) {
      return NextResponse.json({ error: 'Subject, class, and topic are required' }, { status: 400 });
    }

    const [subject, classRecord] = await Promise.all([
      db.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
      db.class.findUnique({ where: { id: classId }, select: { name: true } }),
    ]);

    if (!subject || !classRecord) {
      return NextResponse.json({ error: 'Subject or class not found' }, { status: 404 });
    }

    const systemPrompt = PROMPTS.HOMEWORK_GENERATOR.system;
    const userPrompt = PROMPTS.HOMEWORK_GENERATOR.user({
      subjectName: subject.name,
      className: classRecord.name,
      topic,
      difficulty: difficulty || 'Medium',
      dueInDays: dueInDays || 3,
      additionalInstructions: additionalInstructions || '',
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'TEACHER' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI generation failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<AIHomeworkAssignment>(result.content || '');

    if (!parsed || !parsed.title || !parsed.description) {
      return NextResponse.json({
        error: 'AI returned invalid homework format',
        raw: result.content,
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
      metadata: {
        subject: subject.name,
        class: classRecord.name,
        topic,
      },
    });
  } catch (error) {
    console.error('AI Homework Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate homework' }, { status: 500 });
  }
}
