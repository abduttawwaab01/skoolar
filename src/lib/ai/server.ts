import { checkRateLimit } from '@/lib/rate-limiter';
import { db } from '@/lib/db';

export interface AIServerOptions {
  role?: string;
  model?: string;
  stream?: boolean;
  schoolId?: string;
}

export interface AIServerResult {
  content: string;
  modelUsed: string;
  raw?: any;
}

const AI_PROVIDER = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8080/v1';
const LOCAL_LLM_API_KEY = process.env.LOCAL_LLM_API_KEY || '';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || '';

const FREE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'huggingfaceh4/zephyr-7b-beta:free',
  'microsoft/phi-3-mini-4k-instruct:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-8b',
  'microsoft/phi-4-mini-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  'mistralai/ministral-8b-2512',
  'qwen/qwen-2.5-7b-instruct',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'z-ai/glm-4.5-air:free',
  'openrouter/free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'moonshotai/kimi-k2.6:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-27b-it',
  'google/gemma-3-12b-it',
  'google/gemma-3-4b-it',
  'microsoft/phi-4',
  'cohere/command-r7b-12-2024',
  'ibm-granite/granite-4.1-8b',
  'qwen/qwen3.5-9b',
];

const LOCAL_FALLBACK_MODELS = [
  'llama-3.2-3b-instruct',
  'llama-3.1-8b-instruct',
  'mistral-7b-instruct',
  'phi-3-mini-128k-instruct',
  'gemma-2-9b-it',
];

const FETCH_TIMEOUT_MS = AI_PROVIDER === 'local' ? 60000 : 10000;
const MAX_RETRIES = AI_PROVIDER === 'local' ? 1 : 3;

const SYSTEM_PROMPTS: Record<string, string> = {
  STUDENT: "You are Skoolar AI, a helpful study assistant for students. Help with homework questions, explain concepts, provide study tips. Be encouraging and educational. Keep your responses clear, concise, and age-appropriate. Use examples and step-by-step explanations when helpful.",
  TEACHER: "You are Skoolar AI, a teaching assistant. Help with lesson planning, classroom strategies, assessment ideas, and educational best practices. Provide practical, actionable advice that teachers can implement right away.",
  PARENT: "You are Skoolar AI, a parent-friendly assistant. Help parents understand their child's education, provide tips for supporting learning at home. Be warm, supportive, and easy to understand. Avoid jargon when possible.",
  SCHOOL_ADMIN: "You are Skoolar AI, a school administration assistant. Help with school management, administrative tasks, policy questions, and operational advice. Be professional and efficient.",
  SUPER_ADMIN: "You are Skoolar AI, a platform administrator assistant. Help with platform management, system administration, scaling advice, and technical decisions.",
  ACCOUNTANT: "You are Skoolar AI, a school finance and accounting assistant. Help with financial management, fee collection tracking, expense management, budgeting advice, and financial reporting. Be precise and practical with financial guidance.",
  LIBRARIAN: "You are Skoolar AI, a library management assistant. Help with book organization, library cataloging, reading recommendations, inventory tracking, and library operations. Be helpful and knowledgeable about literature and learning resources.",
  DIRECTOR: "You are Skoolar AI, an educational leadership and director assistant. Help with strategic planning, academic oversight, staff management, school improvement initiatives, and educational leadership decisions. Be insightful and provide strategic guidance.",
};

const DEFAULT_SYSTEM_PROMPT = "You are Skoolar AI, a helpful assistant for the Skoolar school management platform.";

export function getSystemPrompt(role?: string): string {
  return (role && SYSTEM_PROMPTS[role.toUpperCase()]) || DEFAULT_SYSTEM_PROMPT;
}

async function tryOpenRouter(
  messages: Array<{ role: string; content: string }>,
  tryModel: string,
  stream: boolean,
  controller: AbortController,
  startTime: number,
): Promise<Response> {
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
      stream,
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
    console.error(`[AI Server] Model "${tryModel}" failed after ${elapsed}ms: status=${status}`);

    if (status === 401 || status === 403) throw new Error(`API_AUTH_ERROR: Invalid or unauthorized API key (status ${status})`);
    if (status === 429) throw new Error(`RATE_LIMIT: ${errorBody.slice(0, 200)}`);
    if (status === 404) throw new Error(`MODEL_NOT_AVAILABLE: Model "${tryModel}" not found`);
    throw new Error(`OpenRouter error (${status}): ${errorBody.slice(0, 300)}`);
  }

  return response;
}

export async function generateAIResponse(
  messages: Array<{ role: string; content: string }>,
  options?: AIServerOptions,
): Promise<AIServerResult> {
  const { model, stream = false } = options || {};
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const modelsToTry = model && FREE_MODELS.includes(model) ? [model] : FREE_MODELS;

    for (let i = 0; i < modelsToTry.length; i++) {
      const tryModel = modelsToTry[i];
      if (i > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, i - 1), 10000);
        await new Promise(r => setTimeout(r, backoffMs));
      }
      try {
        const response = await tryOpenRouter(messages, tryModel, stream, controller, startTime);
        const elapsed = Date.now() - startTime;
        console.log(`[AI Server] Model "${tryModel}" succeeded in ${elapsed}ms`);

        if (stream) {
          const content = await streamResponse(response);
          return { content, modelUsed: tryModel };
        }

        const json = await response.json();
        const rawContent = json.choices?.[0]?.message?.content || '';
        const cleaned = cleanAIResponse(rawContent);
        return { content: cleaned, modelUsed: tryModel, raw: json };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : '';
        console.log(`[AI Server] Model ${tryModel} failed: ${errMsg?.slice(0, 100)}. Trying next...`);
        // If auth error, don't try other models
        if (errMsg.includes('API_AUTH_ERROR')) throw error;
        continue;
      }
    }

    // All OpenRouter models failed — try local LLM fallback if configured
    if (LOCAL_LLM_BASE_URL && LOCAL_LLM_BASE_URL !== 'http://localhost:8080/v1') {
      console.log('[AI Server] All OpenRouter models failed, attempting local LLM fallback...');
      try {
        const localResponse = await fetch(`${LOCAL_LLM_BASE_URL}/chat/completions`, {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(LOCAL_LLM_API_KEY ? { Authorization: `Bearer ${LOCAL_LLM_API_KEY}` } : {}),
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
          const json = await localResponse.json();
          const content = json.choices?.[0]?.message?.content || '';
          return { content, modelUsed: LOCAL_LLM_MODEL || 'local' };
        }
      } catch { /* ignore local fallback failure */ }
    }

    throw new Error('All AI models (OpenRouter + local fallback) failed');
  } finally {
    clearTimeout(timeout);
  }
}

async function streamResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
          if (content) accumulated += content;
        } catch { /* skip */ }
      }
    }
  }
  return accumulated;
}

export function cleanAIResponse(content: string): string {
  if (!content) return content;
  const patterns = [
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
    /^\s*>>>\s*\n*[\s\S]*?\n*<<<\s*$/,
    /^\s*===\s*\n*[\s\S]*?\n*===\s*$/,
  ];
  let cleaned = content;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/^\s*[\n\r]+/, '').replace(/[\n\r]+\s*$/, '').trim();
  cleaned = cleaned
    .replace(/^\s*(You are|System:|Assistant:|User:|Human:|AI:)\s*[\s\S]*?\n\n/, '')
    .replace(/^\s*(Hello|Hi|Greetings|Welcome).*?\n\n/, '')
    .replace(/^\s*(Based on|According to|Given).*?\n\n/, '');
  try {
    const jsonMatch = cleaned.match(/^\s*\{[\s\S]*\}[.\s]*$/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.content && typeof parsed.content === 'string') cleaned = parsed.content;
      else if (parsed.message?.content && typeof parsed.message.content === 'string') cleaned = parsed.message.content;
    }
  } catch { /* not JSON */ }
  cleaned = cleaned.replace(/^\{[^}]*\}[,\s]*/, '');
  return cleaned;
}
