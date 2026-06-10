import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AIProfessionalDevelopmentPlan } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'TEACHER' && auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only teachers and admins can generate PD plans' }, { status: 403 });
    }

    const body = await request.json();
    const { teacherName, subjectsTaught, yearsOfExperience, currentQualifications, recentPerformanceRating, careerGoals } = body;

    if (!teacherName) {
      return NextResponse.json({ error: 'Teacher name is required' }, { status: 400 });
    }

    const systemPrompt = PROMPTS.PROFESSIONAL_DEVELOPMENT.system;
    const userPrompt = PROMPTS.PROFESSIONAL_DEVELOPMENT.user({
      teacherName,
      subjectsTaught: subjectsTaught || [],
      yearsOfExperience: yearsOfExperience || 0,
      currentQualifications: currentQualifications || [],
      recentPerformanceRating: recentPerformanceRating || 'Good',
      careerGoals: careerGoals || '',
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'TEACHER' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI generation failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<AIProfessionalDevelopmentPlan>(result.content || '');

    if (!parsed || !parsed.shortTermGoals || !parsed.longTermGoals) {
      return NextResponse.json({
        error: 'AI returned invalid PD plan format',
        raw: result.content,
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    console.error('AI PD Plan Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate PD plan' }, { status: 500 });
  }
}
