import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAIUsage } from '@/lib/ai/client';

// ============================================
// AI Provider — Dual Mode
// ============================================
// Mode 1 (DEFAULT) — OpenRouter (AI_PROVIDER=openrouter)
//   Uses OpenRouter API with multiple free model fallbacks.
//   Configure via OPENROUTER_API_KEY, OPENROUTER_BASE_URL.
//
// Mode 2 — Local LLM (AI_PROVIDER=local)
//   Uses any OpenRouter-compatible API endpoint (vLLM, Ollama, etc.)
//   that you self-host on the Oracle VM.
//   Configure via LOCAL_LLM_BASE_URL, LOCAL_LLM_API_KEY (optional).
//   The local endpoint must support POST /chat/completions.

const AI_PROVIDER = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8080/v1';
const LOCAL_LLM_API_KEY = process.env.LOCAL_LLM_API_KEY || '';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || '';

// API Key validation (OpenRouter format)
function isValidApiKey(key: string | undefined): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  return trimmed.length > 20 && (
    trimmed.startsWith('sk-or-v1-') || 
    trimmed.startsWith('sk-')
  );
}

// OpenRouter free models - ordered by speed & reliability (fastest first) with auto-fallback
// Updated 2025: Current working free models on OpenRouter
const FREE_MODELS = [
  'google/gemini-2.0-flash-exp:free',    // #1 Fastest, excellent quality, free (newest)
  'google/gemini-1.5-flash:free',        // #2 Very fast, proven reliability, free
  'google/gemini-1.5-flash-8b:free',     // #3 Ultra-fast small variant, free
  'meta-llama/llama-3.2-3b-instruct:free', // #4 Fast small model, free
  'microsoft/phi-3-mini-128k-instruct:free', // #5 Fast, 128k context, free
  'meta-llama/llama-3.1-8b-instruct:free', // #6 Good balance speed/quality, free
  'mistralai/mistral-7b-instruct:free',     // #7 Fast, reliable, free
  'qwen/qwen-2.5-7b-instruct:free',      // #8 Fast, good for chat, free
  'deepseek/deepseek-chat-v3:free',      // #9 High quality, free
  'nvidia/nemotron-3-ultra:free',        // #10 Good quality, free
  'openrouter/auto',                     // #11 OpenRouter auto-selects best
];

// Model-specific configurations for better reliability
const MODEL_CONFIG: Record<string, { temperature?: number; maxTokens?: number; timeout?: number }> = {
  'google/gemini-2.0-flash-exp:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'google/gemini-1.5-flash:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'google/gemini-1.5-flash-8b:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'meta-llama/llama-3.2-3b-instruct:free': { temperature: 0.7, maxTokens: 2048, timeout: 25000 },
  'microsoft/phi-3-mini-128k-instruct:free': { temperature: 0.7, maxTokens: 2048, timeout: 25000 },
  'meta-llama/llama-3.1-8b-instruct:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'mistralai/mistral-7b-instruct:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'qwen/qwen-2.5-7b-instruct:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'deepseek/deepseek-chat-v3:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'nvidia/nemotron-3-ultra:free': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
  'openrouter/auto': { temperature: 0.7, maxTokens: 4096, timeout: 30000 },
};

const FETCH_TIMEOUT_MS = AI_PROVIDER === 'local' ? 120000 : 20000;
const MAX_RETRIES = AI_PROVIDER === 'local' ? 1 : FREE_MODELS.length;

// Helper to get model-specific config with defaults
function getModelConfig(model: string) {
  return MODEL_CONFIG[model] || { temperature: 0.7, maxTokens: 4096, timeout: 30000 };
}

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
  ACCOUNTANT:
    "You are Skoolar AI, a school finance and accounting assistant. Help with financial management, fee collection tracking, expense management, budgeting advice, and financial reporting. Be precise and practical with financial guidance.",
  LIBRARIAN:
    "You are Skoolar AI, a library management assistant. Help with book organization, library cataloging, reading recommendations, inventory tracking, and library operations. Be helpful and knowledgeable about literature and learning resources.",
  DIRECTOR:
    "You are Skoolar AI, an educational leadership and director assistant. Help with strategic planning, academic oversight, staff management, school improvement initiatives, and educational leadership decisions. Be insightful and provide strategic guidance.",
};

const DEFAULT_SYSTEM_PROMPT =
  "You are Skoolar AI, a helpful assistant for the Skoolar school management platform.";

async function callAI(messages: Array<{ role: string; content: string }>, model?: string) {
  const actualModel = model?.startsWith('stream:') ? model?.replace('stream:', '') : model;
  const modelConfig = getModelConfig(actualModel || FREE_MODELS[0]);
  const timeoutMs = modelConfig.timeout ?? FETCH_TIMEOUT_MS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startTime = Date.now();

    if (AI_PROVIDER === 'local') {
      const response = await fetch(`${LOCAL_LLM_BASE_URL}/chat/completions`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(LOCAL_LLM_API_KEY ? { 'Authorization': `Bearer ${LOCAL_LLM_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model: model || LOCAL_LLM_MODEL || 'default',
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Local LLM error (${response.status}): ${errorText.slice(0, 300)}`);
      }

      const json = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`[AI Chat] Local LLM succeeded in ${elapsed}ms`);
      return json;
    }

    // OpenRouter provider
    const isStreaming = model?.startsWith('stream:') || false;
    const actualModel = isStreaming ? model?.replace('stream:', '') : model;
    const modelConfig = getModelConfig(actualModel || FREE_MODELS[0]);

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
        model: actualModel || FREE_MODELS[0],
        messages,
        temperature: modelConfig.temperature ?? 0.7,
        max_tokens: modelConfig.maxTokens ?? 4096,
        stream: isStreaming,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      let errorBody = '';
      try {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          errorBody = errorJson.error?.message || errorJson.message || errorText;
        } catch {
          errorBody = errorText;
        }
      } catch {
        errorBody = `HTTP ${status}`;
      }

      const elapsed = Date.now() - startTime;
      console.error(`[AI Chat] Model "${model}" failed after ${elapsed}ms: status=${status}`);

      if (status === 401 || status === 403) throw new Error(`API_AUTH_ERROR: Invalid or unauthorized API key (status ${status})`);
      if (status === 429) throw new Error(`RATE_LIMIT: ${errorBody.slice(0, 200)}`);
      if (status === 404) throw new Error(`MODEL_NOT_AVAILABLE: Model "${model}" not found`);
      throw new Error(`OpenRouter error (${status}): ${errorBody.slice(0, 300)}`);
    }

    if (isStreaming) {
      return response;
    }

    const json = await response.json();
    const elapsed = Date.now() - startTime;
    console.log(`[AI Chat] Model "${model}" succeeded in ${elapsed}ms`);
    return json;
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

    // Validate provider configuration
    if (AI_PROVIDER === 'local') {
      if (!LOCAL_LLM_BASE_URL) {
        return NextResponse.json({ error: 'Local LLM not configured. Set LOCAL_LLM_BASE_URL.' }, { status: 500 });
      }
    } else {
      if (!OPENROUTER_API_KEY) {
        return NextResponse.json({ error: 'AI service not configured. Set OPENROUTER_API_KEY or AI_PROVIDER=local.' }, { status: 500 });
      }
      if (!isValidApiKey(OPENROUTER_API_KEY)) {
        return NextResponse.json({ error: 'AI service configuration error. Invalid API key format.' }, { status: 500 });
      }
    }

    // Rate limiting: 20 requests per 30s per user
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateKey = `ai:${token.id}:${ip}`;
    const rateCheck = await checkRateLimit(rateKey, 20, 30000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
    }

    const body = await request.json();
    const { messages, role, model, stream } = body as {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
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

    const systemPrompt = (role && SYSTEM_PROMPTS[role.toUpperCase()]) || DEFAULT_SYSTEM_PROMPT;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...normalizedMessages,
    ];

    if (AI_PROVIDER === 'local') {
      const completion = await callAI(fullMessages, model);
      const assistantMessage = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
      return NextResponse.json({
        message: { role: 'assistant', content: assistantMessage },
        model: model || LOCAL_LLM_MODEL || 'local',
      });
    }

    // OpenRouter: try models with fallback
    const modelsToTry = model && FREE_MODELS.includes(model) ? [model] : FREE_MODELS;

    if (stream) {
      const streamModel = model || FREE_MODELS[0];
      const completion = await callAI(fullMessages, `stream:${streamModel}`);
      if (completion instanceof Response) {
        return new Response(completion.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
    }

    let lastError: Error | null = null;
    for (let i = 0; i < modelsToTry.length; i++) {
      const tryModel = modelsToTry[i];
      try {
        if (i > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, i - 1), 10000);
          await new Promise(r => setTimeout(r, backoffMs));
        }
        const completion = await callAI(fullMessages, tryModel);
        const assistantMessage = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
        logAIUsage({ feature: 'chat', model: tryModel, tokens: 0, latencyMs: 0, success: true, userId: token.id as string });
        return NextResponse.json({ message: { role: 'assistant', content: assistantMessage }, model: tryModel });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : '';
        console.log(`Model ${tryModel} failed: ${errMsg?.slice(0, 100)}. Trying next model...`);
        lastError = error as Error;
      }
    }

    console.error('[AI Chat] All models failed:', lastError);
    return NextResponse.json({ error: 'AI service temporarily unavailable. Please try again later.' }, { status: 503 });
  } catch (error: unknown) {
    console.error('[AI Chat API Error]', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

     if (message.includes('rate limit') || message.includes('429') || message.includes('Too Many Requests')) {
       return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
     }

     if (message.includes('API_AUTH_ERROR') || message.includes('401') || message.includes('403')) {
       return NextResponse.json({ error: 'AI service authentication error. Please check your API key configuration.' }, { status: 500 });
     }

     return NextResponse.json({ error: `AI service error: ${message}` }, { status: 500 });
  }
}

export async function GET() {
  if (AI_PROVIDER === 'local') {
    return NextResponse.json({
      provider: 'local',
      configured: !!LOCAL_LLM_BASE_URL,
      baseUrl: LOCAL_LLM_BASE_URL,
    });
  }
  return NextResponse.json({
    provider: 'openrouter',
    availableModels: FREE_MODELS.map(m => ({ id: m, type: 'free' })),
    configured: !!OPENROUTER_API_KEY,
  });
}