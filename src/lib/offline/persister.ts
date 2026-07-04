import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { cacheQueryResult, getCachedQueryResult, clearQueryCache } from './db';

const CACHE_KEY_PREFIX = 'react-query-cache';

function getCacheKey(): string {
  return CACHE_KEY_PREFIX;
}

export function createIndexedDbPersister(schoolId: string): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await cacheQueryResult(getCacheKey(), schoolId, client);
      } catch (err) {
        console.error('[Offline Persister] Failed to persist query cache:', err);
      }
    },
    restoreClient: async () => {
      try {
        const result = await getCachedQueryResult<PersistedClient>(getCacheKey());
        return result ?? undefined;
      } catch (err) {
        console.error('[Offline Persister] Failed to restore query cache:', err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await clearQueryCache(schoolId);
      } catch (err) {
        console.error('[Offline Persister] Failed to remove query cache:', err);
      }
    },
  };
}
