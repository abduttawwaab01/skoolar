'use client';

import { WifiOff, Wifi, RefreshCw, X, Upload } from 'lucide-react';
import { useState } from 'react';
import { useOfflineStatus } from '@/hooks/use-offline-status';

export function OfflineBanner() {
  const { isOnline, wasOffline, pendingMutationCount, isSyncing, lastSyncedAt } = useOfflineStatus();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && isOnline) return null;

  if (isOnline && !wasOffline && pendingMutationCount === 0) return null;

  const gotOnline = isOnline && wasOffline;

  return (
    <div className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      isSyncing ? 'bg-amber-50 border-b border-amber-200 dark:bg-amber-950/50 dark:border-amber-800' :
      gotOnline ? 'bg-emerald-50 border-b border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800' :
      'bg-red-50 border-b border-red-200 dark:bg-red-950/50 dark:border-red-800'
    }`}>
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          {isSyncing ? (
            <>
              <RefreshCw className="size-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
              <span className="text-amber-800 dark:text-amber-200 truncate">
                Syncing {pendingMutationCount} pending change{pendingMutationCount !== 1 ? 's' : ''}...
              </span>
            </>
          ) : gotOnline && pendingMutationCount > 0 ? (
            <>
              <Upload className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-emerald-800 dark:text-emerald-200 truncate">
                Back online — {pendingMutationCount} change{pendingMutationCount !== 1 ? 's' : ''} waiting to sync
              </span>
            </>
          ) : gotOnline ? (
            <>
              <Wifi className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-emerald-800 dark:text-emerald-200 truncate">
                Back online
                {lastSyncedAt ? ' — data is up to date' : ''}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="size-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-red-800 dark:text-red-200 truncate">
                You are offline
                {pendingMutationCount > 0 ? ` — ${pendingMutationCount} change${pendingMutationCount !== 1 ? 's' : ''} will sync when connected` : ' — changes will sync when connected'}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-3 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="size-3.5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
}
