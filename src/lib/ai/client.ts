import { AICompletionResult, AIMessage } from './types';

const AI_CHAT_ENDPOINT = '/api/ai/chat';

export async function aiComplete(
  messages: AIMessage[],
  options?: {
    role?: string;
    model?: string;
    signal?: AbortSignal;
  }
): Promise<AICompletionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(AI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        role: options?.role || 'TEACHER',
        model: options?.model,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return {
        success: false,
        error: errorData.error || `Request failed with status ${response.status}`,
        latencyMs: Date.now() - startTime,
      };
    }

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No response content from AI',
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      content,
      modelUsed: data.model,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'Request was cancelled', latencyMs: Date.now() - startTime };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    };
  }
}

export async function aiCompleteStreaming(
  messages: AIMessage[],
  onChunk: (text: string) => void,
  options?: {
    role?: string;
    model?: string;
    signal?: AbortSignal;
  }
): Promise<AICompletionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(AI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        role: options?.role || 'TEACHER',
        model: options?.model,
        stream: true,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return {
        success: false,
        error: errorData.error || `Request failed with status ${response.status}`,
        latencyMs: Date.now() - startTime,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        success: false,
        error: 'Streaming not supported',
        latencyMs: Date.now() - startTime,
      };
    }

    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      if (contentType.includes('text/event-stream')) {
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
              if (content) {
                accumulated += content;
                onChunk(accumulated);
              }
            } catch { /* skip malformed SSE */ }
          }
        }
      } else {
        accumulated += chunk;
        onChunk(accumulated);
      }
    }

    return {
      success: true,
      content: accumulated,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'Request was cancelled', latencyMs: Date.now() - startTime };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    };
  }
}

export interface AIUsageRecord {
  feature: string;
  model: string;
  tokens: number;
  latencyMs: number;
  success: boolean;
  userId: string;
  timestamp: Date;
}

const usageLog: AIUsageRecord[] = [];

export function logAIUsage(record: Omit<AIUsageRecord, 'timestamp'>): void {
  const fullRecord: AIUsageRecord = { ...record, timestamp: new Date() };
  usageLog.push(fullRecord);
  if (usageLog.length > 1000) usageLog.shift();
  console.log(`[AI Usage] ${record.feature}: ${record.success ? 'OK' : 'FAIL'} (${record.latencyMs}ms)`);
}

export function getAIUsageStats(): { totalCalls: number; successRate: number; avgLatencyMs: number } {
  if (usageLog.length === 0) return { totalCalls: 0, successRate: 0, avgLatencyMs: 0 };
  const successful = usageLog.filter(r => r.success).length;
  const totalLatency = usageLog.reduce((sum, r) => sum + r.latencyMs, 0);
  return {
    totalCalls: usageLog.length,
    successRate: Math.round((successful / usageLog.length) * 100),
    avgLatencyMs: Math.round(totalLatency / usageLog.length),
  };
}

export function parseJSONFromAI<T>(content: string): T | null {
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gm, '')
    .replace(/```/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}
