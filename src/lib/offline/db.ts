import type { OfflineEntity, PendingMutation, SyncLogEntry, QueryCacheEntry, MutationStatus } from './types';
import { entityCacheKey } from './idempotency';

const DB_NAME = 'skoolar-offline-v2';
const DB_VERSION = 1;

type StoreName = 'entities' | 'pendingMutations' | 'syncLog' | 'queryCache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('entities')) {
        const entitiesStore = db.createObjectStore('entities', { keyPath: 'id' });
        entitiesStore.createIndex('by_entity_type', 'entityType', { unique: false });
        entitiesStore.createIndex('by_school_id', 'schoolId', { unique: false });
        entitiesStore.createIndex('by_entity_and_school', ['entityType', 'schoolId'], { unique: false });
        entitiesStore.createIndex('by_synced_at', 'syncedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('pendingMutations')) {
        const mutationsStore = db.createObjectStore('pendingMutations', { keyPath: 'id' });
        mutationsStore.createIndex('by_status', 'status', { unique: false });
        mutationsStore.createIndex('by_school_id', 'schoolId', { unique: false });
        mutationsStore.createIndex('by_created_at', 'createdAt', { unique: false });
        mutationsStore.createIndex('by_idempotency_key', 'idempotencyKey', { unique: true });
        mutationsStore.createIndex('by_school_and_status', ['schoolId', 'status'], { unique: false });
      }

      if (!db.objectStoreNames.contains('syncLog')) {
        const logStore = db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true });
        logStore.createIndex('by_mutation_id', 'mutationId', { unique: false });
        logStore.createIndex('by_synced_at', 'syncedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('queryCache')) {
        const cacheStore = db.createObjectStore('queryCache', { keyPath: 'key' });
        cacheStore.createIndex('by_school_id', 'schoolId', { unique: false });
        cacheStore.createIndex('by_updated_at', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(db: IDBDatabase, storeName: StoreName, mode: IDBTransactionMode = 'readonly') {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

async function withDB<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDB();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

// ─── Entity Cache ───

export async function cacheEntity(entityType: string, entityId: string, schoolId: string, data: unknown, version = 1): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'entities', 'readwrite');
    const id = entityCacheKey(entityType, entityId);
    const existing = await new Promise<OfflineEntity | undefined>((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || undefined);
      req.onerror = () => resolve(undefined);
    });
    const entry: OfflineEntity = {
      id,
      entityType,
      entityId,
      schoolId,
      data,
      version: existing ? Math.max(existing.version, version) : version,
      syncedAt: existing?.syncedAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    store.put(entry);
  });
}

export async function cacheEntities(entityType: string, schoolId: string, items: { id: string; data: unknown; version?: number }[]): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'entities', 'readwrite');
    const now = Date.now();
    for (const item of items) {
      const id = entityCacheKey(entityType, item.id);
      const existing = await new Promise<OfflineEntity | undefined>((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || undefined);
        req.onerror = () => resolve(undefined);
      });
      store.put({
        id,
        entityType,
        entityId: item.id,
        schoolId,
        data: item.data,
        version: existing ? Math.max(existing.version, item.version ?? 1) : (item.version ?? 1),
        syncedAt: existing?.syncedAt ?? now,
        updatedAt: now,
      } satisfies OfflineEntity);
    }
  });
}

export async function getCachedEntity<T = unknown>(entityType: string, entityId: string): Promise<{ data: T; version: number } | null> {
  return withDB(async (db) => {
    const store = getStore(db, 'entities');
    const req = store.get(entityCacheKey(entityType, entityId));
    const entry: OfflineEntity | undefined = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || undefined);
      req.onerror = () => resolve(undefined);
    });
    if (!entry) return null;
    return { data: entry.data as T, version: entry.version };
  });
}

export async function getCachedEntitiesByType<T = unknown>(entityType: string, schoolId: string): Promise<{ data: T; id: string; version: number }[]> {
  return withDB(async (db) => {
    const store = getStore(db, 'entities');
    const index = store.index('by_entity_and_school');
    const range = IDBKeyRange.only([entityType, schoolId]);
    const results: OfflineEntity[] = await new Promise((resolve, reject) => {
      const items: OfflineEntity[] = [];
      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });
    return results.map((e) => ({ data: e.data as T, id: e.entityId, version: e.version }));
  });
}

export async function removeCachedEntity(entityType: string, entityId: string): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'entities', 'readwrite');
    store.delete(entityCacheKey(entityType, entityId));
  });
}

export async function clearEntityCache(schoolId?: string): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'entities', 'readwrite');
    if (schoolId) {
      const index = store.index('by_school_id');
      const range = IDBKeyRange.only(schoolId);
      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } else {
      store.clear();
    }
  });
}

// ─── Pending Mutations Queue ───

export async function queueMutation(mutation: PendingMutation): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'pendingMutations', 'readwrite');
    store.put(mutation);
  });
}

export async function getPendingMutations(schoolId?: string, status?: MutationStatus): Promise<PendingMutation[]> {
  return withDB(async (db) => {
    const store = getStore(db, 'pendingMutations');
    
    if (schoolId && status) {
      const index = store.index('by_school_and_status');
      const range = IDBKeyRange.only([schoolId, status]);
      return collectCursor<PendingMutation>(index.openCursor(range));
    }
    if (schoolId) {
      const index = store.index('by_school_id');
      return collectCursor<PendingMutation>(index.openCursor(IDBKeyRange.only(schoolId)));
    }
    if (status) {
      const index = store.index('by_status');
      return collectCursor<PendingMutation>(index.openCursor(IDBKeyRange.only(status)));
    }
    return collectCursor<PendingMutation>(store.openCursor());
  });
}

export async function getPendingMutationById(id: string): Promise<PendingMutation | undefined> {
  return withDB(async (db) => {
    const store = getStore(db, 'pendingMutations');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || undefined);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function updateMutationStatus(id: string, status: MutationStatus, error?: string): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'pendingMutations', 'readwrite');
    const req = store.get(id);
    const mutation: PendingMutation | undefined = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || undefined);
      req.onerror = () => resolve(undefined);
    });
    if (mutation) {
      mutation.status = status;
      if (error) mutation.error = error;
      mutation.retryCount = status === 'pending' ? mutation.retryCount + 1 : mutation.retryCount;
      store.put(mutation);
    }
  });
}

export async function removeMutation(id: string): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'pendingMutations', 'readwrite');
    store.delete(id);
  });
}

export async function countPendingMutations(schoolId?: string): Promise<number> {
  return withDB(async (db) => {
    const store = getStore(db, 'pendingMutations');
    const index = schoolId ? store.index('by_school_id') : store.index('by_status');
    const range = schoolId ? IDBKeyRange.only(schoolId) : IDBKeyRange.only('pending');
    return new Promise((resolve, reject) => {
      const req = index.count(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

// ─── Sync Log ───

export async function addSyncLogEntry(entry: SyncLogEntry): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'syncLog', 'readwrite');
    store.add(entry);
  });
}

export async function getSyncLog(limit = 50): Promise<SyncLogEntry[]> {
  return withDB(async (db) => {
    const store = getStore(db, 'syncLog');
    const index = store.index('by_synced_at');
    const entries: SyncLogEntry[] = [];
    return new Promise((resolve, reject) => {
      const req = index.openCursor(null, 'prev');
      let count = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && count < limit) {
          entries.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(entries);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

// ─── Query Cache ───

export async function cacheQueryResult(key: string, schoolId: string, data: unknown): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'queryCache', 'readwrite');
    store.put({ key, schoolId, data, updatedAt: Date.now() } satisfies QueryCacheEntry);
  });
}

export async function getCachedQueryResult<T = unknown>(key: string): Promise<T | null> {
  return withDB(async (db) => {
    const store = getStore(db, 'queryCache');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result?.data as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearQueryCache(schoolId?: string): Promise<void> {
  return withDB(async (db) => {
    const store = getStore(db, 'queryCache', 'readwrite');
    if (schoolId) {
      const index = store.index('by_school_id');
      const range = IDBKeyRange.only(schoolId);
      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } else {
      store.clear();
    }
  });
}

// ─── Storage Info ───

export async function getStorageInfo(): Promise<{ usage: number; quota: number | null; entityCount: number; mutationCount: number }> {
  let usage = 0;
  let quota: number | null = null;

  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    usage = estimate.usage ?? 0;
    quota = estimate.quota ?? null;
  }

  const entityCount = await withDB(async (db) => {
    const store = getStore(db, 'entities');
    return new Promise<number>((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  });

  const mutationCount = await countPendingMutations();

  return { usage, quota, entityCount, mutationCount };
}

// ─── Helpers ───

function collectCursor<T>(request: IDBRequest<IDBCursorWithValue | null>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const items: T[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
