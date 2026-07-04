export function generateIdempotencyKey(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateMutationId(): string {
  return `${Date.now()}-${generateIdempotencyKey().slice(0, 12)}`;
}

export function entityCacheKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function queryCacheKey(schoolId: string, queryKey: unknown[]): string {
  const hash = JSON.stringify(queryKey);
  return `${schoolId}:${hash}`;
}
