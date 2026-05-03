/**
 * Type-safe JSON parsing utilities
 * Ensures proper typing when parsing JSON fields from database
 */

/**
 * Safely parse a JSON string or return null if invalid
 * @param value - The JSON string to parse
 * @returns Parsed object or null if parsing fails
 */
export function safeJsonParse<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Safely parse exam question options (array of strings)
 */
export function parseQuestionOptions(value: string | null | undefined): string[] {
  const parsed = safeJsonParse<unknown>(value);
  if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
    return parsed;
  }
  return [];
}

/**
 * Safely parse correct answer (can be string, number, array, or boolean)
 */
export function parseCorrectAnswer(value: string | null | undefined): string | number | string[] | boolean | null {
  return safeJsonParse<string | number | string[] | boolean>(value);
}

/**
 * Safely parse exam attempt answers (object mapping questionId to answer)
 */
export function parseAttemptAnswers(value: string | null | undefined): Record<string, unknown> {
  const parsed = safeJsonParse<unknown>(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

/**
 * Safely parse exam security settings
 */
export function parseSecuritySettings(value: string | null | undefined): Record<string, unknown> {
  const parsed = safeJsonParse<unknown>(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

/**
 * Safely parse security violations array
 */
export function parseSecurityViolations(value: string | null | undefined): Array<{ type: string; timestamp: number; count: number }> {
  const parsed = safeJsonParse<unknown>(value);
  if (Array.isArray(parsed)) {
    return parsed.filter(
      item =>
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        'timestamp' in item &&
        'count' in item
    ) as Array<{ type: string; timestamp: number; count: number }>;
  }
  return [];
}
