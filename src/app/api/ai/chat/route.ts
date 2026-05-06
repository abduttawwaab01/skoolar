import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

// Priority: minimax first, then other free models as fallbacks
// These are verified working free models on OpenRouter
const FREE_MODELS = [
  'minimax/minimax-chat-completion:free',  // Primary - minimax
  'qwen/qwen3-8b:free',            // Fallback 1 - Qwen
  'deepseek/deepseek-r1:free',         // Fallback 2 - DeepSeek R1  
  'meta-llama/llama-3.2-3b-instruct:free', // Fallback 3 - Llama
  'google/gemma-3n-e4b-it:free',     // Fallback 4 - Gemma
];

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

async function callOpenRouter(messages: Array<{ role: string; content: string }>, model: string = 'qwen/qwen3-8b:free') {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
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

    const body = await request.json();
    const { messages, role, model } = body as {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      role?: string;
      model?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const isValidMessages = messages.every(
      (msg) => typeof msg.content === 'string' && ['system', 'user', 'assistant'].includes(msg.role)
    );

    if (!isValidMessages) {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    const systemPrompt = (role && SYSTEM_PROMPTS[role.toUpperCase()]) || DEFAULT_SYSTEM_PROMPT;
    const userMessages = messages.filter((msg) => msg.role !== 'system');

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    const selectedModel = model && FREE_MODELS.includes(model) ? model : FREE_MODELS[0];

    // Try each model with fallback on rate limit
    let lastError: Error | null = null;
    for (const tryModel of FREE_MODELS) {
      try {
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
        // If rate limited, try next model
        if (errMsg.includes('429') || errMsg.includes('rate limit')) {
          console.log(`Rate limited on ${tryModel}, trying next model...`);
          lastError = error as Error;
          continue;
        }
        // Other errors - stop trying
        throw error;
      }
    }

    // All models failed
    throw lastError;
  } catch (error: unknown) {
    console.error('[AI Chat API Error]', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message.includes('rate limit') || message.includes('429')) {
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