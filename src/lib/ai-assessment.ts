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
  'qwen/qwen-2.5-7b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen-2.5-coder-7b-instruct:free',
  'nvidia/llama-3.1-nemotron-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
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

class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async callAPI(prompt: string, systemPrompt: string): Promise<AIGenerationResult> {
    const start = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], temperature: 0.7, response_format: { type: 'json_object' } }),
      });
      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `OpenAI error: ${error}`, modelUsed: this.model, latencyMs: Date.now() - start };
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: 'No response from AI', modelUsed: this.model, latencyMs: Date.now() - start };
      try {
        return { success: true, data: JSON.parse(content), modelUsed: this.model, latencyMs: Date.now() - start };
      } catch {
        return { success: true, data: { raw: content }, modelUsed: this.model, latencyMs: Date.now() - start };
      }
    } catch (error) {
      return { success: false, error: `OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown'}`, modelUsed: this.model, latencyMs: Date.now() - start };
    }
  }

  async generateQuestions(params: { topics: string[]; domain: string; difficulty: string; count: number; questionTypes?: string[]; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return this.callAPI(JSON.stringify(params), `You are an expert educational assessment designer. Generate ${params.count} ${params.difficulty}-level questions for ${params.targetType}s in "${params.domain}" domain covering topics: ${params.topics.join(', ')}. Return JSON with a "questions" array.`);
  }

  async gradeResponse(params: { questionText: string; rubric?: string; studentAnswer: string; maxMarks: number }): Promise<AIGenerationResult> {
    return this.callAPI(JSON.stringify(params), 'You are an expert grader. Evaluate the answer. Return JSON with: score, feedback, strengths, weaknesses.');
  }

  async generateRecommendations(params: { profile: Record<string, unknown>; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return this.callAPI(JSON.stringify(params), `Analyze this ${params.targetType} assessment profile and generate personalized recommendations. Return JSON with a "recommendations" array.`);
  }

  async analyzeProfile(params: { profileData: Record<string, unknown>; targetType: 'student' | 'teacher' }): Promise<AIGenerationResult> {
    return this.callAPI(JSON.stringify(params), `Analyze this ${params.targetType}'s profile. Return JSON with: summary, strengths, areasForImprovement, suggestedFocus.`);
  }

  async generateReport(params: { data: Record<string, unknown>; reportType: string }): Promise<AIGenerationResult> {
    return this.callAPI(JSON.stringify(params), `Generate a ${params.reportType} assessment report. Return JSON with: executiveSummary, detailedAnalysis, recommendations.`);
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
  { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen 2.5 7B', provider: 'Qwen', free: true, speed: 'fast' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'Meta', free: true, speed: 'very fast' },
  { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small 3', provider: 'Mistral', free: true, speed: 'fast' },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini', provider: 'Microsoft', free: true, speed: 'very fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', provider: 'Meta', free: true, speed: 'medium' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', provider: 'DeepSeek', free: true, speed: 'medium' },
  { id: 'qwen/qwen-2.5-coder-7b-instruct:free', name: 'Qwen Coder 7B', provider: 'Qwen', free: true, speed: 'fast' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B', provider: 'NVIDIA', free: true, speed: 'medium' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'Google', free: true, speed: 'fast' },
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
            primaryModel: config.primaryModel || 'qwen/qwen-2.5-7b-instruct:free',
            fallbackModels: fallbacks.length > 0 ? fallbacks : undefined,
            maxRetries: config.maxRetries ?? 1,
            timeoutMs: config.requestTimeoutMs ?? 10000,
          });
        }

        if (provider === 'openai' || provider === 'auto') {
          const key = config.apiKeyEncrypted ? validateApiKeyFormat(config.apiKeyEncrypted) : null;
          if (key) {
            const modelMap: Record<string, string> = {
              'gemini-flash': 'gpt-4', 'gemini-pro': 'gpt-4', 'deepseek': 'gpt-4',
              'llama': 'gpt-3.5-turbo', 'mistral': 'gpt-3.5-turbo',
              'gpt4': 'gpt-4', 'gpt4-turbo': 'gpt-4-turbo', 'gpt35-turbo': 'gpt-3.5-turbo',
            };
            return new OpenAIProvider(key, modelMap[config.aiModel] || 'gpt-4');
          }
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
      primaryModel: 'qwen/qwen-2.5-7b-instruct:free',
      fallbackModels: FREE_OPENROUTER_MODELS.filter(m => m !== 'qwen/qwen-2.5-7b-instruct:free'),
      maxRetries: 1,
      timeoutMs: 10000,
    });
  }

  const platformKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (platformKey) {
    return new OpenAIProvider(platformKey, 'gpt-4');
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

function validateApiKeyFormat(encrypted: string): string | null {
  try {
    if (encrypted.startsWith('sk-') || encrypted.startsWith('sk-ant-')) return encrypted;
    return null;
  } catch {
    return null;
  }
}
