import type { PendingMutation, OfflineGatewayOptions } from './types';
import {
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  addSyncLogEntry,
  cacheEntity,
  getCachedEntity,
} from './db';
import { generateIdempotencyKey } from './idempotency';

export type SyncEventCallback = (event: 'start' | 'progress' | 'complete' | 'error' | 'conflict', data?: unknown) => void;

class OfflineSyncEngine {
  private isSyncing = false;
  private syncQueue: Array<{ schoolId?: string; resolve: (result: { synced: number; failed: number; conflicts: number }) => void }> = [];
  private listeners: Set<SyncEventCallback> = new Set();
  private options: OfflineGatewayOptions = {};

  configure(opts: OfflineGatewayOptions): void {
    this.options = opts;
  }

  on(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: 'start' | 'progress' | 'complete' | 'error' | 'conflict', data?: unknown): void {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  async syncAll(schoolId?: string): Promise<{ synced: number; failed: number; conflicts: number }> {
    if (this.isSyncing) {
      return new Promise((resolve) => {
        this.syncQueue.push({ schoolId, resolve });
      });
    }
    this.isSyncing = true;
    this.emit('start');

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      const pending = await getPendingMutations(schoolId, 'pending');
      const failedMutations = await getPendingMutations(schoolId, 'failed');

      const toSync = [...pending, ...failedMutations].sort((a, b) => a.createdAt - b.createdAt);

      for (const mutation of toSync) {
        this.emit('progress', { mutationId: mutation.id, entityType: mutation.entityType, current: toSync.indexOf(mutation) + 1, total: toSync.length });

        try {
          const result = await this.replayMutation(mutation);
          if (result === 'conflict') {
            conflicts++;
          } else {
            synced++;
          }
        } catch (err) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : 'Unknown sync error';
          await updateMutationStatus(mutation.id, 'failed', errorMsg);
          await addSyncLogEntry({
            mutationId: mutation.id,
            status: 'failed',
            error: errorMsg,
            syncedAt: Date.now(),
          });
          this.options.onSyncError?.(mutation.id, errorMsg);
          this.emit('error', { mutationId: mutation.id, error: errorMsg });
        }
      }
    } finally {
      this.isSyncing = false;
      this.emit('complete', { synced, failed, conflicts });
      this.options.onSyncComplete?.();
      const next = this.syncQueue.shift();
      if (next) {
        this.syncAll(next.schoolId).then(next.resolve);
      }
    }

    return { synced, failed, conflicts };
  }

  private async replayMutation(mutation: PendingMutation): Promise<'ok' | 'conflict'> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': mutation.idempotencyKey || generateIdempotencyKey(),
    };

    if (mutation.retryCount >= mutation.maxRetries) {
      await updateMutationStatus(mutation.id, 'failed', 'Max retries exhausted');
      await addSyncLogEntry({
        mutationId: mutation.id,
        status: 'failed',
        error: 'Max retries exhausted',
        syncedAt: Date.now(),
      });
      this.options.onSyncError?.(mutation.id, 'Max retries exhausted');
      this.emit('error', { mutationId: mutation.id, error: 'Max retries exhausted' });
      // Treat as permanently failed — don't throw, skip it
      return 'ok';
    }

    if (mutation.method !== 'DELETE' && mutation.entityType) {
      const entityId = this.extractEntityId(mutation.url, mutation.method);
      if (entityId) {
        const cached = await getCachedEntity(mutation.entityType, entityId, mutation.schoolId);
        if (cached && cached.version) {
          headers['X-Entity-Version'] = String(cached.version);
        }
      }
    }

    const res = await fetch(mutation.url, {
      method: mutation.method,
      headers,
      body: mutation.body ? JSON.stringify(mutation.body) : undefined,
    });

    let responseData: unknown = null;
    try {
      responseData = await res.json();
    } catch {
      responseData = { status: res.status, statusText: res.statusText };
    }

    if (res.ok) {
      await removeMutation(mutation.id);
      await addSyncLogEntry({
        mutationId: mutation.id,
        status: 'synced',
        response: responseData,
        syncedAt: Date.now(),
      });

      if (mutation.method === 'DELETE' && mutation.entityType) {
        const entityId = this.extractEntityId(mutation.url, mutation.method);
        if (entityId) {
          const { removeCachedEntity } = await import('./db');
          await removeCachedEntity(mutation.entityType, entityId, mutation.schoolId);
        }
      }

      if (mutation.method === 'POST' && mutation.entityType) {
        const createdId = (responseData as any)?.data?.id || (responseData as any)?.id;
        if (createdId) {
          await cacheEntity(mutation.entityType, createdId, mutation.schoolId, responseData, 1);
        }
      }

      if ((mutation.method === 'PUT' || mutation.method === 'PATCH') && mutation.entityType) {
        const entityId = this.extractEntityId(mutation.url, mutation.method);
        if (entityId && responseData) {
          const responseBody = (responseData as any)?.data || (responseData as any);
          if (responseBody && typeof responseBody === 'object') {
            await cacheEntity(mutation.entityType, entityId, mutation.schoolId, responseBody, Date.now());
          }
        }
      }

      return 'ok';
    }

    if (res.status === 409) {
      await updateMutationStatus(mutation.id, 'conflict', 'Server conflict: version mismatch');
      await addSyncLogEntry({
        mutationId: mutation.id,
        status: 'conflict',
        response: responseData,
        syncedAt: Date.now(),
      });

      const entityId = this.extractEntityId(mutation.url, mutation.method);
      if (entityId && mutation.entityType && responseData) {
        const serverData = (responseData as any)?.data || (responseData as any)?.serverData || responseData;
        await cacheEntity(mutation.entityType, entityId, mutation.schoolId, serverData, Date.now());
      }

      this.options.onConflict?.(mutation, responseData);
      this.emit('conflict', { mutation, serverData: responseData });
      return 'conflict';
    }

    if (res.status === 412) {
      await updateMutationStatus(mutation.id, 'failed', 'Precondition failed');
      throw new Error(`Precondition failed for ${mutation.entityType}`);
    }

    const errorMsg = (responseData as any)?.error || `Sync failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  private extractEntityId(url: string, method: string): string | null {
    try {
      const path = new URL(url, window.location.origin).pathname;
      const parts = path.split('/').filter(Boolean);
      if (method === 'DELETE' || method === 'PATCH' || method === 'PUT') {
        return parts.length >= 3 ? parts[2] : null;
      }
      if (method === 'POST') return null;
      return null;
    } catch {
      return null;
    }
  }

  get isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

export const syncEngine = new OfflineSyncEngine();

export async function triggerSync(schoolId?: string): Promise<ReturnType<typeof syncEngine.syncAll>> {
  return syncEngine.syncAll(schoolId);
}
