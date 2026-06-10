import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { PROMPTS } from '@/lib/ai/prompts';
import { aiComplete, parseJSONFromAI } from '@/lib/ai/client';
import { AIParentMessage } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    if (auth.role !== 'TEACHER' && auth.role !== 'SCHOOL_ADMIN' && auth.role !== 'SUPER_ADMIN' && auth.role !== 'DIRECTOR') {
      return NextResponse.json({ error: 'Only teachers and admins can generate communications' }, { status: 403 });
    }

    const body = await request.json();
    const { communicationType, studentName, className, senderName, schoolName, details } = body;

    if (!studentName || !communicationType) {
      return NextResponse.json({ error: 'Student name and communication type are required' }, { status: 400 });
    }

    const systemPrompt = PROMPTS.PARENT_COMMUNICATION.system;
    const userPrompt = PROMPTS.PARENT_COMMUNICATION.user({
      communicationType: communicationType || 'general',
      studentName,
      className: className || '',
      senderName: senderName || 'Teacher',
      schoolName: schoolName || 'School',
      details: details || {},
    });

    const result = await aiComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { role: 'TEACHER' });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'AI communication failed' }, { status: 500 });
    }

    const parsed = parseJSONFromAI<AIParentMessage>(result.content || '');

    return NextResponse.json({
      success: true,
      data: parsed || { subject: 'Communication', body: '', tone: 'formal', keyPoints: [] },
      modelUsed: result.modelUsed,
    });
  } catch (error) {
    console.error('AI Communication Error:', error);
    return NextResponse.json({ error: 'Failed to generate communication' }, { status: 500 });
  }
}
