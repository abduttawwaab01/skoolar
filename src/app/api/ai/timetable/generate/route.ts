import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AITimetableSlot } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Only admins can generate timetables' }, { status: 403 });
    }

    const body = await request.json();
    const schoolId = auth.role === 'SUPER_ADMIN' && body.schoolId ? body.schoolId : auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const {
      academicYearId,
      termId,
      name,
      availablePeriodsPerDay = 8,
      periodDurationMinutes = 40,
      startHour = 8,
      daysInWeek = 5,
      subjectPeriodDistribution,
    } = body;

    if (!academicYearId || !name) {
      return NextResponse.json({ error: 'Academic year and timetable name are required' }, { status: 400 });
    }

    const [school, academicYear, classes, subjects, teachers] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      db.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, name: true } }),
      db.class.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, name: true, grade: true } }),
      db.subject.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, name: true, code: true } }),
      db.teacher.findMany({
        where: { schoolId, deletedAt: null },
        include: { user: { select: { name: true } } },
      }),
    ]);

    if (!school || !academicYear) {
      return NextResponse.json({ error: 'School or academic year not found' }, { status: 404 });
    }

    const term = termId ? await db.term.findUnique({ where: { id: termId }, select: { name: true } }) : null;

    const subjectPeriodsPerWeek = subjectPeriodDistribution ||
      subjects.map(s => ({ subjectId: s.id, periods: Math.max(1, Math.floor(availablePeriodsPerDay * daysInWeek / Math.max(1, subjects.length))) }));

    const existingConflicts: Array<{ type: string; description: string }> = [];
    const conflictSlots = await db.timetableSlot.findMany({
      where: {
        isCancelled: false,
        timetable: { schoolId, deletedAt: null },
      },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { include: { user: { select: { name: true } } } },
        timetable: { select: { name: true } },
      },
      take: 50,
    });

    const conflictMap = new Map<string, number>();
    for (const slot of conflictSlots) {
      const key = `${slot.dayOfWeek}-${slot.period}`;
      conflictMap.set(key, (conflictMap.get(key) || 0) + 1);
    }
    for (const [key, count] of conflictMap) {
      if (count > 1) {
        const [day, period] = key.split('-');
        existingConflicts.push({
          type: 'overlap',
          description: `Day ${day}, Period ${period}: ${count} slots overlapping`,
        });
      }
    }

    const systemPrompt = PROMPTS.TIMETABLE_GENERATOR.system;
    const userPrompt = PROMPTS.TIMETABLE_GENERATOR.user({
      schoolName: school.name,
      academicYear: academicYear.name,
      term: term?.name || 'N/A',
      classes: classes.map(c => ({ id: c.id, name: c.name, grade: c.grade || '' })),
      subjects: subjects.map(s => ({ id: s.id, name: s.name, code: s.code || '' })),
      teachers: teachers.map(t => ({ id: t.id, name: t.user?.name || 'Unknown' })),
      availablePeriodsPerDay,
      periodDurationMinutes,
      startHour,
      daysInWeek,
      subjectPeriodsPerWeek,
      existingConflicts: existingConflicts.length > 0 ? existingConflicts : undefined,
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'SCHOOL_ADMIN' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI generation failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<{ timetable: AITimetableSlot[]; conflictsResolved: number; notes: string }>(result.content || '');
    if (!parsed || !parsed.timetable) {
      return NextResponse.json({
        error: 'AI returned invalid timetable format',
        raw: result.content,
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
      metadata: {
        schoolName: school.name,
        academicYear: academicYear.name,
        term: term?.name || null,
        classes: classes.length,
        subjects: subjects.length,
        teachers: teachers.length,
        slotsGenerated: parsed.timetable.length,
      },
    });
  } catch (error) {
    console.error('AI Timetable Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate timetable' }, { status: 500 });
  }
}
