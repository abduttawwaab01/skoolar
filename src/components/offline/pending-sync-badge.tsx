'use client';

import { CloudOff, Cloud, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/use-offline-status';

interface PendingSyncBadgeProps {
  className?: string;
}

export function PendingSyncBadge({ className = '' }: PendingSyncBadgeProps) {
  const { isOnline, pendingMutationCount, isSyncing } = useOfflineStatus();

  if (pendingMutationCount === 0 && isOnline) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      isSyncing
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
        : isOnline
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
          : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
    } ${className}`}>
      {isSyncing ? (
        <RefreshCw className="size-3 animate-spin" />
      ) : isOnline ? (
        <Cloud className="size-3" />
      ) : (
        <CloudOff className="size-3" />
      )}
      {pendingMutationCount > 0 ? `${pendingMutationCount} pending` : isSyncing ? 'Syncing...' : 'Offline'}
    </span>
  );
}

export function OfflineIndicator({ className = '' }: { className?: string }) {
  const { isOnline } = useOfflineStatus();

  if (isOnline) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 ${className}`}>
      <AlertTriangle className="size-3" />
      Offline
    </span>
  );
}
