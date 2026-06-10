import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Only admins can optimize timetables' }, { status: 403 });
    }

    const body = await request.json();
    const schoolId = (auth.role === 'SUPER_ADMIN' && body.schoolId) ? body.schoolId : auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 });
    }

    const [school, allSlots] = await Promise.all([
      db.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
      db.timetableSlot.findMany({
        where: { isCancelled: false, timetable: { schoolId, deletedAt: null } },
        include: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { include: { user: { select: { name: true } } } },
          timetable: { select: { name: true } },
        },
      }),
    ]);

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const conflicts: Array<{ type: string; description: string }> = [];
    const slotGroups = new Map<string, typeof allSlots>();
    for (const slot of allSlots) {
      const key = `${slot.dayOfWeek}-${slot.period}`;
      const group = slotGroups.get(key) || [];
      group.push(slot);
      slotGroups.set(key, group);
    }
    for (const [key, group] of slotGroups) {
      if (group.length > 1) {
        conflicts.push({ type: 'overlap', description: `Day ${key.split('-')[0]}, Period ${key.split('-')[1]}: ${group.length} slots overlapping` });
      }
    }

    const systemPrompt = PROMPTS.TIMETABLE_OPTIMIZER.system;
    const userPrompt = PROMPTS.TIMETABLE_OPTIMIZER.user({
      schoolName: school.name,
      totalSlots: allSlots.length,
      currentConflicts: conflicts,
      scheduleData: `Total Timetable Slots: ${allSlots.length}\nTotal Conflicts: ${conflicts.length}`,
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'SCHOOL_ADMIN' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI optimization failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<{ conflictsFound: Array<Record<string, unknown>>; optimizationScore: number; suggestedChanges: Array<Record<string, unknown>>; overallEfficiency: string }>(result.content || '');

    return NextResponse.json({
      success: true,
      data: parsed || { conflictsFound: conflicts, optimizationScore: 0, suggestedChanges: [], overallEfficiency: 'Analysis complete' },
      modelUsed: result.modelUsed,
      metadata: { schoolName: school.name, totalSlots: allSlots.length, totalConflicts: conflicts.length },
    });
  } catch (error) {
    console.error('AI Timetable Optimize Error:', error);
    return NextResponse.json({ error: 'Failed to optimize timetable' }, { status: 500 });
  }
}
