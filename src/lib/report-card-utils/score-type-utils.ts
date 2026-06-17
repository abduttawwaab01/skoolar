const NAME_TO_KEY: Record<string, string> = {
  'ca1': 'ca1', 'ca.1': 'ca1', 'ca 1': 'ca1',
  'test1': 'ca1', 'test 1': 'ca1', 'quiz1': 'ca1', 'quiz 1': 'ca1',
  'continuousassessment1': 'ca1', 'continuousassessment 1': 'ca1',
  'ca2': 'ca2', 'ca.2': 'ca2', 'ca 2': 'ca2',
  'test2': 'ca2', 'test 2': 'ca2', 'quiz2': 'ca2', 'quiz 2': 'ca2',
  'continuousassessment2': 'ca2', 'continuousassessment 2': 'ca2',
  'assignment': 'assignment', 'homework': 'assignment', 'home work': 'assignment',
  'project': 'project',
};

export function normalizeScoreTypeKey(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, '');
  return NAME_TO_KEY[key] || key;
}

export function getScoreValue(
  scoresByType: Record<string, { raw: number; max: number; normalized: number }> | undefined,
  normalizedKey: string,
): number | null {
  if (!scoresByType) return null;
  if (scoresByType[normalizedKey]?.raw !== undefined) {
    return Math.round(scoresByType[normalizedKey].raw);
  }
  for (const [key, val] of Object.entries(scoresByType)) {
    if (key.toLowerCase().replace(/\s+/g, '') === normalizedKey) {
      return Math.round(val.raw);
    }
  }
  return null;
}

export function getScoreDisplay(
  scoresByType: Record<string, { raw: number; max: number; normalized: number }> | undefined,
  normalizedKey: string,
  fallback: string = '—',
): string {
  const val = getScoreValue(scoresByType, normalizedKey);
  return val !== null ? String(val) : fallback;
}
