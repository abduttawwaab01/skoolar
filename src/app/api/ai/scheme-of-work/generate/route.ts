import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AISchemeOfWorkEntry } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Only teachers and admins can generate schemes of work' }, { status: 403 });
    }

    const body = await request.json();
    const schoolId = (auth.role === 'SUPER_ADMIN' && body.schoolId) ? body.schoolId : auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const { subjectId, classId, termId, numberOfWeeks = 12, focusAreas } = body;

    if (!subjectId || !classId || !termId) {
      return NextResponse.json({ error: 'Subject, class, and term are required' }, { status: 400 });
    }

    const [subject, classRecord, term, school] = await Promise.all([
      db.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true, code: true } }),
      db.class.findUnique({ where: { id: classId }, select: { id: true, name: true, grade: true } }),
      db.term.findUnique({
        where: { id: termId },
        select: { id: true, name: true, academicYearId: true, academicYear: { select: { name: true } } },
      }),
      db.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
    ]);

    if (!subject || !classRecord || !term || !school) {
      return NextResponse.json({ error: 'Subject, class, term, or school not found' }, { status: 404 });
    }

    const systemPrompt = PROMPTS.SCHEME_OF_WORK_GENERATOR.system;
    const userPrompt = PROMPTS.SCHEME_OF_WORK_GENERATOR.user({
      subjectName: subject.name,
      className: classRecord.name,
      gradeLevel: classRecord.grade || '',
      termName: term.name,
      academicYear: term.academicYear.name,
      numberOfWeeks,
      curriculumStandard: `${school.name} - ${subject.name} Curriculum`,
      focusAreas,
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'TEACHER' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI generation failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<{
      title: string;
      description: string;
      entries: AISchemeOfWorkEntry[];
      totalWeeks: number;
      recommendedTextbooks: string[];
    }>(result.content || '');

    if (!parsed || !parsed.entries || parsed.entries.length === 0) {
      return NextResponse.json({
        error: 'AI returned invalid scheme of work format',
        raw: result.content,
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: {
        title: parsed.title || `${subject.name} - ${classRecord.name} - ${term.name}`,
        description: parsed.description || '',
        entries: parsed.entries,
        totalWeeks: parsed.totalWeeks || numberOfWeeks,
        recommendedTextbooks: parsed.recommendedTextbooks || [],
      },
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
      metadata: {
        subject: subject.name,
        class: classRecord.name,
        term: term.name,
        weeks: numberOfWeeks,
      },
    });
  } catch (error) {
    console.error('AI Scheme of Work Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate scheme of work' }, { status: 500 });
  }
}
