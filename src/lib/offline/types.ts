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

export interface MutationConflict {
  mutation: PendingMutation;
  localData: unknown;
  serverData: unknown;
  resolved: boolean;
  resolution?: 'keep-local' | 'keep-server' | 'merge';
  resolvedAt?: number;
}

export interface QueuedSocketEvent {
  id: string;
  event: string;
  data: unknown;
  schoolId: string;
  createdAt: number;
}

export interface QueuedFileUpload {
  id: string;
  fileInfo: { name: string; type: string; size: number; lastModified: number };
  fileData: string; // base64 encoded
  endpoint: string;
  schoolId: string;
  userId: string;
  createdAt: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}
