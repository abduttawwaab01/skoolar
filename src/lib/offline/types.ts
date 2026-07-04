export interface OfflineEntity {
  id: string;
  entityType: string;
  entityId: string;
  schoolId: string;
  data: unknown;
  version: number;
  syncedAt: number | null;
  updatedAt: number;
}

export type MutationStatus = 'pending' | 'synced' | 'failed' | 'conflict';

export interface PendingMutation {
  id: string;
  entityType: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  schoolId: string;
  userId: string;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
  status: MutationStatus;
  error?: string;
}

export interface SyncLogEntry {
  id?: number;
  mutationId: string;
  status: MutationStatus;
  response?: unknown;
  error?: string;
  syncedAt: number;
}

export interface QueryCacheEntry {
  key: string;
  schoolId: string;
  data: unknown;
  updatedAt: number;
}

export interface OfflineState {
  isOnline: boolean;
  pendingMutationCount: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
}

export interface OfflineGatewayOptions {
  onSyncComplete?: () => void;
  onSyncError?: (mutationId: string, error: string) => void;
  onConflict?: (mutation: PendingMutation, serverData: unknown) => void;
}
