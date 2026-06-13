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
// Updated June 2026: ONLY CONFIRMED WORKING FREE MODELS on OpenRouter
// Source: openrouter.ai/models (filter: free) — verified June 2026
const FREE_MODELS = [
  // === TIER 1: Fast General Chat Models (BEST for chat) ===
  'qwen/qwen-2.5-7b-instruct:free',          // Fast, reliable, good for general chat
  'meta-llama/llama-3.2-3b-instruct:free',   // Fastest small model, excellent for chat
  'mistralai/mistral-small-24b-instruct-2501:free', // Mistral Small 3, fast & capable
  'microsoft/phi-3-mini-128k-instruct:free', // Very fast, 128K context
  
  // === TIER 2: Higher Quality / Reasoning ===
  'meta-llama/llama-3.3-70b-instruct:free',  // Larger, higher quality responses
  'deepseek/deepseek-r1:free',               // Strong reasoning, rival to o1
  'qwen/qwen-2.5-coder-7b-instruct:free',    // Good for general and coding tasks
  
  // === TIER 3: Additional Fallbacks ===
  'nvidia/llama-3.1-nemotron-70b-instruct:free', // NVIDIA, fast & reliable
  'google/gemini-2.0-flash-exp:free',         // Google, 1M context, experimental
];

// Local LLM fallback models
const LOCAL_FALLBACK_MODELS = [
  'llama-3.2-3b-instruct',
  'llama-3.1-8b-instruct',
  'mistral-7b-instruct',
  'phi-3-mini-128k-instruct',
  'gemma-2-9b-it',
];

// Validate OpenRouter API key configuration
if (!OPENROUTER_API_KEY) {
  console.warn('WARNING: OPENROUTER_API_KEY is not configured. AI functionality will be limited.');
}

const FETCH_TIMEOUT_MS = AI_PROVIDER === 'local' ? 60000 : 10000;
const MAX_RETRIES = AI_PROVIDER === 'local' ? 1 : 3;

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

async function callAI(messages: Array<{ role: string; content: string }>, model?: string, stream?: boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
          stream: stream || false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Local LLM error (${response.status}): ${errorText.slice(0, 300)}`);
      }

      if (stream) return response;

      const json = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`[AI Chat] Local LLM succeeded in ${elapsed}ms`);
      return json;
    }

    // OpenRouter provider with local fallback

    async function tryOpenRouter(tryModel: string, attempt: number = 1): Promise<any> {
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
          model: tryModel,
          messages,
          temperature: 0.7,
          max_tokens: 4096,
          stream: stream || false,
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
        console.error(`[AI Chat] Model "${tryModel}" failed after ${elapsed}ms: status=${status}`);

        if (status === 401 || status === 403) throw new Error(`API_AUTH_ERROR: Invalid or unauthorized API key (status ${status})`);
        if (status === 429) {
          if (attempt < MAX_RETRIES) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`[AI Chat] Rate limited on ${tryModel}, retrying in ${retryDelay}ms (attempt ${attempt}/${MAX_RETRIES})...`);
            await new Promise(r => setTimeout(r, retryDelay));
            return tryOpenRouter(tryModel, attempt + 1);
          }
          throw new Error(`RATE_LIMIT: ${errorBody.slice(0, 200)} (after ${MAX_RETRIES} retries)`);
        }
        if (status === 404) throw new Error(`MODEL_NOT_AVAILABLE: Model "${tryModel}" not found`);
        throw new Error(`OpenRouter error (${status}): ${errorBody.slice(0, 300)}`);
      }

      if (stream) return response;

      const json = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`[AI Chat] Model "${tryModel}" succeeded in ${elapsed}ms`);
      return json;
    }

    // When a specific model is requested, only try that model
    if (model) {
      return await tryOpenRouter(model);
    }

    // Otherwise try all free models with fallback
    for (const tryModel of FREE_MODELS) {
      try {
        return await tryOpenRouter(tryModel);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : '';
        console.log(`Model ${tryModel} failed: ${errMsg?.slice(0, 100)}. Trying next model...`);
        continue;
      }
    }

    // All OpenRouter models failed - try local LLM fallback if configured
    if (LOCAL_LLM_BASE_URL && LOCAL_LLM_BASE_URL !== 'http://localhost:8080/v1') {
      console.log('[AI Chat] All OpenRouter models failed, attempting local LLM fallback...');
      try {
        const localResponse = await fetch(`${LOCAL_LLM_BASE_URL}/chat/completions`, {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(LOCAL_LLM_API_KEY ? { 'Authorization': `Bearer ${LOCAL_LLM_API_KEY}` } : {}),
          },
          body: JSON.stringify({
            model: LOCAL_LLM_MODEL || LOCAL_FALLBACK_MODELS[0],
            messages,
            temperature: 0.7,
            max_tokens: 4096,
            stream: false,
          }),
        });

        if (localResponse.ok) {
          const localJson = await localResponse.json();
          const elapsed = Date.now() - startTime;
          console.log(`[AI Chat] Local LLM fallback succeeded in ${elapsed}ms`);
          return localJson;
        }
      } catch (localError) {
        console.error('[AI Chat] Local LLM fallback also failed:', localError);
      }
    }

    throw new Error('All AI models (OpenRouter + local fallback) failed');
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
      const completion = await callAI(fullMessages, streamModel, true);
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
        const rawContent = completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";
        const assistantMessage = cleanAIResponse(rawContent);
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

// Clean AI response to remove system prompt echoes, special tokens, etc.
function cleanAIResponse(content: string): string {
  if (!content) return content;
  
  // Remove system prompt echoes and special tokens (using [\s\S] instead of . with /s flag)
  const systemPromptPatterns = [
    /^You are Skoolar AI[\s\S]*?\n\n/,
    /^System:[\s\S]*?\n\n/,
    /^Assistant:[\s\S]*?\n\n/,
    /^\[INST\][\s\S]*?\[\/INST\]/,
    /^<\|im_start\|>[\s\S]*?<\|im_end\|>/,
    /^<\|user\|>[\s\S]*?<\|assistant\|>/,
    /^[\s\S]*?<\/s>/,
    /^### System:[\s\S]*?###/,
    /^### Human:[\s\S]*?###/,
    /^### Assistant:[\s\S]*?###/,
    /^User:[\s\S]*?\n\n/,
    /^\s*---\s*\n*\s*User:/,
    /^\s*---\s*\n*\s*Assistant:/,
    /^\s*##\s*System Prompt:\s*\n*[\s\S]*?\n*##/,
    /^\s*##\s*User Question:\s*\n*[\s\S]*?\n*##/,
    /^\s*##\s*Assistant Response:\s*\n*[\s\S]*?\n*##/,
    /^\s*---\s*\n*[\s\S]*?\n*---\s*$/,
    /^\s*\*\*\*\s*System:\s*[\s\S]*?\s*\*\*\*\s*$/,
    /^\s*\*\*\*\s*User:\s*[\s\S]*?\s*\*\*\*\s*$/,
    /^\s*\*\*\*\s*Assistant:\s*[\s\S]*?\s*\*\*\*\s*$/,
    /^\s*---\s*\n*[\s\S]*?\n*---\s*$/,
    /^\s*>>>\s*\n*[\s\S]*?\n*<<<\s*$/,
    /^\s*===\s*\n*[\s\S]*?\n*===\s*$/,
  ];
  
  let cleaned = content;
  for (const pattern of systemPromptPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove leading/trailing whitespace and common artifacts
  cleaned = cleaned
    .replace(/^\s*[\n\r]+/, '')  // Leading newlines
    .replace(/[\n\r]+\s*$/, '')  // Trailing newlines
    .trim();
  
  // Remove common patterns that indicate system prompts
  cleaned = cleaned
    .replace(/^\s*(You are|System:|Assistant:|User:|Human:|AI:)\s*[\s\S]*?\n\n/, '')
    .replace(/^\s*(Hello|Hi|Greetings|Welcome).*?\n\n/, '')
    .replace(/^\s*(Based on|According to|Given).*?\n\n/, '');
  
  // Remove JSON response wrappers that models sometimes add (e.g. {"role":"assistant","content":"..."})
  // This handles cases where the model wraps the response in a JSON structure
  try {
    const jsonMatch = cleaned.match(/^\s*\{[\s\S]*\}[.\s]*$/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.content && typeof parsed.content === 'string') {
        cleaned = parsed.content;
      } else if (parsed.message?.content && typeof parsed.message.content === 'string') {
        cleaned = parsed.message.content;
      }
    }
  } catch {
    // Not valid JSON, continue with cleaned text
  }

  // Remove partial JSON artifacts (truncated JSON at start or end)
  cleaned = cleaned.replace(/^\{[^}]*\}[,\s]*/, '');
  
  return cleaned;
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