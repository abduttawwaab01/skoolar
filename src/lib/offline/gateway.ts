import type { PendingMutation } from './types';
import { cacheEntity, getCachedEntity, queueMutation } from './db';
import { generateMutationId, generateIdempotencyKey, queryCacheKey } from './idempotency';

interface GatewayResult<T = unknown> {
  data: T;
  fromCache: boolean;
  isPlaceholder?: boolean;
}

interface PendingResult {
  queued: boolean;
  mutationId: string;
  idempotencyKey: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function isWriteMethod(method: HttpMethod): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function parseEntityFromUrl(url: string, method: HttpMethod): { entityType: string; entityId?: string } | null {
  try {
    const path = new URL(url, window.location.origin).pathname;
    const parts = path.split('/').filter(Boolean);

    // /api/students → entityType: 'students'
    // /api/students/123 → entityType: 'students', entityId: '123'
    // /api/attendance/scan → entityType: 'attendance'
    if (parts[0] === 'api' && parts.length >= 2) {
      const entityType = parts[1];
      const entityId = parts.length > 2 && !['scan', 'sync'].includes(parts[2]) ? parts[2] : undefined;
      return { entityType, entityId };
    }
    return null;
  } catch {
    return null;
  }
}

let currentSchoolId = '';
let currentUserId = '';

export function setGatewayContext(schoolId: string, userId: string): void {
  currentSchoolId = schoolId;
  currentUserId = userId;
}

export async function offlineGateway<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<GatewayResult<T> | PendingResult> {
  const method = (options.method || 'GET').toUpperCase() as HttpMethod;
  const isOnline = navigator.onLine;
  const entityInfo = parseEntityFromUrl(url, method);

  if (isWriteMethod(method)) {
    if (!isOnline) {
      const mutationId = generateMutationId();
      const idempotencyKey = generateIdempotencyKey();

      const mutation: PendingMutation = {
        id: mutationId,
        entityType: entityInfo?.entityType ?? 'unknown',
        method,
        url,
        body: options.body ? tryParseBody(options.body) : undefined,
        schoolId: currentSchoolId,
        userId: currentUserId,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 5,
        idempotencyKey,
        status: 'pending',
      };

      await queueMutation(mutation);

      return {
        queued: true,
        mutationId,
        idempotencyKey,
      };
    }

    if (entityInfo?.entityType && entityInfo.entityId) {
      options.headers = {
        ...options.headers,
        'X-Idempotency-Key': generateIdempotencyKey(),
      };
    }

    try {
      const res = await fetch(url, options);
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error((data as any)?.error || `Request failed with status ${res.status}`);
      }
      if (method === 'POST' && entityInfo?.entityType && data) {
        const createdId = (data as any)?.data?.id || (data as any)?.id;
        if (createdId) {
          const version = (data as any)?.data?._version || (data as any)?._version || 1;
          await cacheEntity(entityInfo.entityType, createdId, currentSchoolId, data, version);
        }
      }
      return { data: data as T, fromCache: false };
    } catch (err) {
      throw err;
    }
  }

  if (entityInfo?.entityType && entityInfo.entityId && !isOnline) {
    const cached = await getCachedEntity(entityInfo.entityType, entityInfo.entityId);
    if (cached) {
      return { data: cached.data as T, fromCache: true };
    }
  }

  if (!isOnline) {
    const urlKey = queryCacheKey(currentSchoolId, [url]);
    const cached = await getCachedQueryResult<T>(urlKey);
    if (cached) {
      return { data: cached, fromCache: true };
    }
    throw new Error('You are offline and no cached data is available for this request.');
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error((data as any)?.error || `Request failed with status ${res.status}`);
    }

    if (entityInfo?.entityType) {
      const responseData = (data as any)?.data ?? data;
      if (Array.isArray(responseData)) {
        const items = responseData.map((item: any) => ({
          id: item.id,
          data: item,
          version: item._version || 1,
        }));
        const { cacheEntities } = await import('./db');
        await cacheEntities(entityInfo.entityType!, currentSchoolId, items);
      } else if (responseData?.id) {
        await cacheEntity(entityInfo.entityType, responseData.id, currentSchoolId, responseData, responseData._version || 1);
      }

      const urlKey = queryCacheKey(currentSchoolId, [url, options]);
      const { cacheQueryResult } = await import('./db');
      await cacheQueryResult(urlKey, currentSchoolId, data);
    }

    return { data: data as T, fromCache: false };
  } catch (err) {
    const urlKey = queryCacheKey(currentSchoolId, [url]);
    const cached = await getCachedQueryResult<T>(urlKey);
    if (cached) {
      return { data: cached, fromCache: true };
    }
    throw err;
  }
}

function tryParseBody(body: BodyInit | null | undefined): unknown {
  if (!body) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return undefined;
}

async function getCachedQueryResult<T>(key: string): Promise<T | null> {
  const { getCachedQueryResult: getCached } = await import('./db');
  return getCached<T>(key);
}
