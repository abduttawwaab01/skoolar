import { db } from '@/lib/db';

export interface AIGenerationResult {
  success: boolean;
  data?: unknown;
  error?: string;
  modelUsed?: string;
  latencyMs?: number;
}

export interface GeneratedQuestion {
  type: string;
  questionText: string;
  options?: string;
  correctAnswer?: string;
  explanation?: string;
  skillTag?: string;
  difficulty: string;
  marks: number;
}

interface AIProvider {
  generateQuestions(params: {
    topics: string[];
    domain: string;
    difficulty: string;
    count: number;
    questionTypes?: string[];
    targetType: 'student' | 'teacher';
  }): Promise<AIGenerationResult>;

  gradeResponse(params: {
    questionText: string;
    rubric?: string;
    studentAnswer: string;
    maxMarks: number;
  }): Promise<AIGenerationResult>;

  generateRecommendations(params: {
    profile: Record<string, unknown>;
    targetType: 'student' | 'teacher';
  }): Promise<AIGenerationResult>;

  analyzeProfile(params: {
    profileData: Record<string, unknown>;
    targetType: 'student' | 'teacher';
  }): Promise<AIGenerationResult>;

  generateReport(params: {
    data: Record<string, unknown>;
    reportType: string;
  }): Promise<AIGenerationResult>;
}

const FREE_OPENROUTER_MODELS = [
  // Tier 1 - Top quality, fast (July 2026)
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openai/gpt-oss-120b:free',
  // Tier 2 - Good quality, fast
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  // Tier 3 - Lightweight fallbacks
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-4-26b-a4b-it:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  // Tier 4 - Last resort
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  // Auto-router
  'openrouter/free',
];

class FallbackProvider implements AIProvider {
  async generateQuestions(params: {
    topics: string[]; domain: string; difficulty: string; count: number;
    questionTypes?: string[]; targetType: 'student' | 'teacher';
  }): Promise<AIGenerationResult> {
    const questions: GeneratedQuestion[] = [];
    for (let i = 0; i < params.count; i++) {
      const topic = params.topics[i % params.topics.length];
      questions.push({
        type: 'MCQ',
        questionText: `Sample ${params.difficulty} question about ${topic} (${params.domain}) - Question ${i + 1}`,
        options: JSON.stringify(['Option A', 'Option B', 'Option C', 'Option D']),
        correctAnswer: JSON.stringify('Option A'),
        explanation: `This is a sample explanation for the question about ${topic}.`,
        skillTag: topic,
        difficulty: params.difficulty,
        marks: 1,
      });
    }
    return { success: true, data: { questions }, modelUsed: 'fallback' };
  }

  async gradeResponse(params: { questionText: string; rubric?: string; studentAnswer: string; maxMarks: number }): Promise<AIGenerationResult> {
    const wordCount = params.studentAnswer.split(/\s+/).length;
    const score = Math.min(params.maxMarks, Math.ceil(wordCount / 20));
    return {
      success: true, data: { score, feedback: `Your answer contained ${wordCount} words. Score: ${score}/${params.maxMarks}.`, strengths: ['Attempted the question'], weaknesses: ['Could provide more detail'] },
      modelUsed: 'fallback',
    };
  }

  async generateRecommendations(params: { profile: Record<string, unknown>; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return {
      success: true, data: { recommendations: [{ type: 'study_material', title: 'Review Core Concepts', description: 'Focus on strengthening foundational knowledge.', priority: 'high' }] },
      modelUsed: 'fallback',
    };
  }

  async analyzeProfile(params: { profileData: Record<string, unknown>; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return {
      success: true, data: { summary: 'Profile analysis complete.', strengths: ['Consistent effort'], areasForImprovement: ['Identify specific skills needing attention'], suggestedFocus: ['Focus on weakest areas first'] },
      modelUsed: 'fallback',
    };
  }

  async generateReport(params: { data: Record<string, unknown>; reportType: string }): Promise<AIGenerationResult> {
    return {
      success: true, data: { executiveSummary: 'Assessment report generated.', detailedAnalysis: 'Varied performance across domains.', recommendations: ['Continue practicing'] },
      modelUsed: 'fallback',
    };
  }
}

class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private models: string[];
  private maxRetries: number;
  private timeoutMs: number;

  constructor(config: {
    apiKey: string;
    primaryModel?: string;
    fallbackModels?: string[];
    maxRetries?: number;
    timeoutMs?: number;
  }) {
    this.apiKey = config.apiKey;
    this.models = [
      config.primaryModel || 'qwen/qwen-2.5-7b-instruct:free',
      ...(config.fallbackModels || FREE_OPENROUTER_MODELS.filter(m => m !== config.primaryModel)),
    ];
    this.maxRetries = config.maxRetries ?? 2;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private async callModel(prompt: string, systemPrompt: string, modelIndex: number = 0): Promise<AIGenerationResult> {
    if (modelIndex >= this.models.length) {
      return { success: false, error: `All ${this.models.length} models exhausted` };
    }

    const model = this.models[modelIndex];
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://skoolar.com',
          'X-Title': 'Skoolar Assessment Hub',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        const isRateLimit = response.status === 429;
        const isOverloaded = response.status === 502 || response.status === 503;

        if ((isRateLimit || isOverloaded) && modelIndex < this.models.length - 1) {
          return this.callModel(prompt, systemPrompt, modelIndex + 1);
        }

        return {
          success: false,
          error: `OpenRouter error (${model}): ${errorText}`,
          modelUsed: model,
          latencyMs: Date.now() - start,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        if (modelIndex < this.models.length - 1) {
          return this.callModel(prompt, systemPrompt, modelIndex + 1);
        }
        return { success: false, error: `No response from ${model}`, modelUsed: model, latencyMs: Date.now() - start };
      }

      try {
        const parsed = JSON.parse(
          content.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim()
        );
        return { success: true, data: parsed, modelUsed: model, latencyMs: Date.now() - start };
      } catch {
        return { success: true, data: { raw: content }, modelUsed: model, latencyMs: Date.now() - start };
      }
    } catch (error: any) {
      const isAbort = error?.name === 'AbortError';
      const isTimeout = error?.message?.includes('timeout') || isAbort;

      if ((isTimeout || isAbort) && modelIndex < this.models.length - 1) {
        const nextIdx = isAbort ? modelIndex + 1 : modelIndex + 1;
        return this.callModel(prompt, systemPrompt, nextIdx);
      }

      return {
        success: false,
        error: `OpenRouter ${model} failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        modelUsed: model,
        latencyMs: Date.now() - start,
      };
    }
  }

  private async retryCall(prompt: string, systemPrompt: string): Promise<AIGenerationResult> {
    // Try all models in order. callModel already handles internal fallback.
    const result = await this.callModel(prompt, systemPrompt, 0);

    // If all models exhausted, retry once from beginning (handles transient blips)
    if (!result.success) {
      await new Promise(r => setTimeout(r, 1000));
      return this.callModel(prompt, systemPrompt, 0);
    }

    return result;
  }

  async generateQuestions(params: { topics: string[]; domain: string; difficulty: string; count: number; questionTypes?: string[]; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return this.retryCall(
      JSON.stringify({ topics: params.topics, domain: params.domain, difficulty: params.difficulty, count: params.count, questionTypes: params.questionTypes, targetType: params.targetType }),
      `You are an expert educational assessment designer. Generate ${params.count} ${params.difficulty}-level questions for ${params.targetType}s in the "${params.domain}" domain covering topics: ${params.topics.join(', ')}. Return ONLY valid JSON with a "questions" array where each question has: type (string), questionText (string), options (JSON string if MCQ/Multiple Answer), correctAnswer (string), explanation (string), skillTag (string), difficulty (string), marks (number).`
    );
  }

  async gradeResponse(params: { questionText: string; rubric?: string; studentAnswer: string; maxMarks: number }): Promise<AIGenerationResult> {
    return this.retryCall(
      JSON.stringify(params),
      'You are an expert grader. Evaluate the student answer against the question and rubric. Return ONLY valid JSON with: score (number), feedback (string), strengths (string[]), weaknesses (string[]). Be fair and constructive.'
    );
  }

  async generateRecommendations(params: { profile: Record<string, unknown>; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return this.retryCall(
      JSON.stringify(params),
      `You are an expert educational advisor. Analyze this ${params.targetType}'s assessment profile and generate personalized, actionable recommendations. Return ONLY valid JSON with a "recommendations" array where each item has: type (string), title (string), description (string), priority ("high" | "medium" | "low"). Include 3-5 recommendations.`
    );
  }

  async analyzeProfile(params: { profileData: Record<string, unknown>; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return this.retryCall(
      JSON.stringify(params),
      `You are an expert educational analyst. Analyze this ${params.targetType}'s profile data. Return ONLY valid JSON with: summary (string), strengths (string[]), areasForImprovement (string[]), suggestedFocus (string[]). Be specific and data-driven.`
    );
  }

  async generateReport(params: { data: Record<string, unknown>; reportType: string }): Promise<AIGenerationResult> {
    return this.retryCall(
      JSON.stringify(params),
      `You are an expert report writer. Generate a ${params.reportType} assessment report. Return ONLY valid JSON with: executiveSummary (string), detailedAnalysis (string), recommendations (string[]). Be thorough and professional.`
    );
  }
}

const FREE_MODEL_LIST = [
  // Tier 1 - Top quality, fast (July 2026)
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'Google', free: true, speed: 'fast' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B', provider: 'NVIDIA', free: true, speed: 'fast' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', provider: 'OpenAI', free: true, speed: 'medium' },
  // Tier 2 - Good quality, fast
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B', provider: 'OpenAI', free: true, speed: 'very fast' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano 30B', provider: 'NVIDIA', free: true, speed: 'fast' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', provider: 'Qwen', free: true, speed: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', free: true, speed: 'medium' },
  // Tier 3 - Lightweight fallbacks
  { id: 'nvidia/nemotron-nano-9b-v2:free', name: 'Nemotron Nano 9B v2', provider: 'NVIDIA', free: true, speed: 'very fast' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B', provider: 'Google', free: true, speed: 'medium' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen3 Next 80B A3B', provider: 'Qwen', free: true, speed: 'medium' },
  // Tier 4 - Last resort
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B', provider: 'NVIDIA', free: true, speed: 'slow' },
  // Auto-router
  { id: 'openrouter/free', name: 'OpenRouter Free', provider: 'OpenRouter', free: true, speed: 'auto' },
];

export function getAvailableModels() {
  return FREE_MODEL_LIST;
}

export function getFreeModels() {
  return FREE_MODEL_LIST.filter(m => m.free);
}

export async function getAIProvider(schoolId?: string): Promise<AIProvider> {
  if (schoolId) {
    try {
      const config = await db.aIAssessmentConfig.findUnique({ where: { schoolId } });
      if (config?.aiEnabled) {
        const provider = config.provider || 'auto';

        if ((provider === 'openrouter' || provider === 'auto') && config.openrouterKey) {
          const fallbacks = [config.fallbackModel1, config.fallbackModel2, config.fallbackModel3].filter(Boolean) as string[];
          return new OpenRouterProvider({
            apiKey: config.openrouterKey,
            primaryModel: config.primaryModel || 'google/gemma-4-31b-it:free',
            fallbackModels: fallbacks.length > 0 ? fallbacks : undefined,
            maxRetries: config.maxRetries ?? 1,
            timeoutMs: config.requestTimeoutMs ?? 10000,
          });
        }
      }
    } catch {
      // fall through
    }
  }

  const platformOpenRouterKey = process.env.OPENROUTER_API_KEY;
  if (platformOpenRouterKey) {
    return new OpenRouterProvider({
      apiKey: platformOpenRouterKey,
      primaryModel: 'google/gemma-4-31b-it:free',
      fallbackModels: FREE_OPENROUTER_MODELS.filter(m => m !== 'google/gemma-4-31b-it:free'),
      maxRetries: 1,
      timeoutMs: 10000,
    });
  }

  return new FallbackProvider();
}

export async function generateQuestions(
  topics: string[], domain: string, difficulty: string = 'intermediate',
  count: number = 10, targetType: 'student' | 'teacher' = 'student',
  schoolId?: string, questionTypes?: string[]
): Promise<AIGenerationResult> {
  const provider = await getAIProvider(schoolId);
  return provider.generateQuestions({ topics, domain, difficulty, count, questionTypes, targetType });
}

export async function gradeResponse(
  questionText: string, studentAnswer: string, maxMarks: number,
  rubric?: string, schoolId?: string
): Promise<AIGenerationResult> {
  const provider = await getAIProvider(schoolId);
  return provider.gradeResponse({ questionText, rubric, studentAnswer, maxMarks });
}

export async function generateRecommendations(
  profile: Record<string, unknown>, targetType: 'student' | 'teacher', schoolId?: string
): Promise<AIGenerationResult> {
  const provider = await getAIProvider(schoolId);
  return provider.generateRecommendations({ profile, targetType });
}

export async function analyzeProfile(
  profileData: Record<string, unknown>, targetType: 'student' | 'teacher', schoolId?: string
): Promise<AIGenerationResult> {
  const provider = await getAIProvider(schoolId);
  return provider.analyzeProfile({ profileData, targetType });
}

export async function generateReport(
  data: Record<string, unknown>, reportType: string, schoolId?: string
): Promise<AIGenerationResult> {
  const provider = await getAIProvider(schoolId);
  return provider.generateReport({ data, reportType });
}


