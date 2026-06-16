import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAIUsage } from '@/lib/ai/client';
import { generateAIResponse, getSystemPrompt, cleanAIResponse } from '@/lib/ai/server';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn('WARNING: OPENROUTER_API_KEY is not configured. AI functionality will be limited.');
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (AI_PROVIDER === 'local' ? !process.env.LOCAL_LLM_BASE_URL : !OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = await checkRateLimit(`ai:${token.id}:${ip}`, 20, 30000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }

    const body = await request.json();
    const { messages, role, model, stream } = body as {
      messages: Array<{ role: string; content: string }>;
      role?: string;
      model?: string;
      stream?: boolean;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const normalizedMessages = messages
      .filter((msg) => msg && typeof msg.content === 'string')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

    if (normalizedMessages.length === 0) {
      return NextResponse.json({ error: 'No valid messages to process' }, { status: 400 });
    }

    const systemPrompt = getSystemPrompt(role);
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...normalizedMessages,
    ];

    if (stream) {
      const result = await generateAIResponse(fullMessages, { model, stream: true });
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(result.content));
          controller.close();
        },
      }), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const result = await generateAIResponse(fullMessages, { model });
    const assistantMessage = cleanAIResponse(result.content);
    logAIUsage({ feature: 'chat', model: result.modelUsed, tokens: 0, latencyMs: 0, success: true, userId: token.id as string });

    return NextResponse.json({ message: { role: 'assistant', content: assistantMessage }, model: result.modelUsed });
  } catch (error: unknown) {
    console.error('[AI Chat Error]', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message.includes('rate limit') || message.includes('429')) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }
    if (message.includes('API_AUTH_ERROR') || message.includes('401') || message.includes('403')) {
      return NextResponse.json({ error: 'AI service authentication error. Please check your API key configuration.' }, { status: 500 });
    }
    return NextResponse.json({ error: `AI service error: ${message}` }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    provider: AI_PROVIDER,
    configured: !!OPENROUTER_API_KEY,
  });
}