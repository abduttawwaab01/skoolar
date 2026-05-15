import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rate-limiter';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

// Use openrouter/free as primary (auto-routes to best available free model)
// Then specific free models as fallbacks — confirmed active on OpenRouter as of May 2026
const FREE_MODELS = [
  'openrouter/free',                              // Auto-router (26+ free models)
  'nvidia/nemotron-3-super:free',                 // 120B MoE, 262K context
  'minimax/minimax-m2.5:free',                    // MiniMax M2.5
  'google/gemma-4-31b:free',                      // Gemma 4 31B
  'meta-llama/llama-3.2-3b-instruct:free',        // Fast lightweight
  'nousresearch/hermes-3-llama-3.1-405b:free',    // 405B, high quality
  'openai/gpt-oss-120b:free',                     // OpenAI's open model
];

const FETCH_TIMEOUT_MS = 30000;
const MAX_RETRIES = FREE_MODELS.length;

const SYSTEM_PROMPTS: Record<string, string> = {
  STUDENT:
    "You are Skoolar AI, a helpful study assistant for students. Help with homework questions, explain concepts, provide study tips. Be encouraging and educational. Keep your responses clear, concise, and age-appropriate. Use examples and step-by-step explanations when helpful.",
  TEACHER:
    "You are Skoolar AI, a teaching assistant. Help with lesson planning, classroom strategies, assessment ideas, and educational best practices. Provide practical, actionable advice that teachers can implement right away.",
  PARENT:
    "You are Skoolar AI, a parent-friendly assistant. Help parents understand their child's education, provide tips for supporting learning at home. Be warm, supportive, and easy to understand. Avoid jargon when possible.",
  SCHOOL_ADMIN:
    "You are Skoolar AI, a school administration assistant. Help with school management, administrative tasks, policy questions, and operational advice. Be professional and efficient.",
  SUPER_ADMIN:
    "You are Skoolar AI, a platform administrator assistant. Help with platform management, system administration, scaling advice, and technical decisions.",
};

const DEFAULT_SYSTEM_PROMPT =
  "You are Skoolar AI, a helpful assistant for the Skoolar school management platform.";

async function callOpenRouter(messages: Array<{ role: string; content: string }>, model: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://skoolar.org',
        'X-Title': 'Skoolar',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 });
    }

    // Rate limiting: 20 requests per 30s per user
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateKey = `ai:${token.id}:${ip}`;
    const rateCheck = await checkRateLimit(rateKey, 20, 30000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }

    const body = await request.json();
    const { messages, role, model } = body as {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      role?: string;
      model?: string;
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

    const systemPrompt = (role && SYSTEM_PROMPTS[role.toUpperCase()]) || DEFAULT_SYSTEM_PROMPT;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...normalizedMessages,
    ];

    const modelsToTry = model && FREE_MODELS.includes(model) ? [model] : FREE_MODELS;

    let lastError: Error | null = null;
    for (let i = 0; i < modelsToTry.length; i++) {
      const tryModel = modelsToTry[i];
      try {
        // Exponential backoff: wait 1s, 2s, 4s... between retries
        if (i > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, i - 1), 10000);
          await new Promise(r => setTimeout(r, backoffMs));
        }

        const completion = await callOpenRouter(fullMessages, tryModel);

        const assistantMessage = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

        return NextResponse.json({
          message: {
            role: 'assistant',
            content: assistantMessage,
          },
          model: tryModel,
        });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : '';
        console.log(`Model ${tryModel} failed: ${errMsg?.slice(0, 100)}. Trying next model...`);
        lastError = error as Error;
      }
    }

    console.error('[AI Chat] All models failed:', lastError);
    return NextResponse.json(
      { error: 'AI service temporarily unavailable. Please try again later.' },
      { status: 503 }
    );
  } catch (error: unknown) {
    console.error('[AI Chat API Error]', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message.includes('rate limit') || message.includes('429') || message.includes('Too Many Requests')) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }

    return NextResponse.json({ error: `AI service error: ${message}` }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    availableModels: FREE_MODELS.map(m => ({ id: m, type: 'free' })),
    configured: !!OPENROUTER_API_KEY,
  });
}