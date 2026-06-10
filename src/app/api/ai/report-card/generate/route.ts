import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AIReportCardComment } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'TEACHER' && auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only teachers and admins can generate report card comments' }, { status: 403 });
    }

    const body = await request.json();
    const {
      studentName, className, subject, termName, academicYear,
      overallScore, grade, strengths, weaknesses, attendanceRate,
    } = body;

    if (!studentName || !subject) {
      return NextResponse.json({ error: 'Student name and subject are required' }, { status: 400 });
    }

    const systemPrompt = PROMPTS.REPORT_CARD_COMMENT.system;
    const userPrompt = PROMPTS.REPORT_CARD_COMMENT.user({
      studentName,
      className: className || '',
      subject,
      termName: termName || '',
      academicYear: academicYear || '',
      overallScore: overallScore || 0,
      grade: grade || '',
      strengths: strengths || [],
      weaknesses: weaknesses || [],
      attendanceRate: attendanceRate || 100,
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'TEACHER' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI generation failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<AIReportCardComment>(result.content || '');

    if (!parsed || !parsed.generalComment) {
      return NextResponse.json({
        error: 'AI returned invalid report card format',
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
    console.error('AI Report Card Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate report card comment' }, { status: 500 });
  }
}
