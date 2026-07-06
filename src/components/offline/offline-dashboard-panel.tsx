'use client';

import { useState } from 'react';
import { Upload, WifiOff, X, HardDrive } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/use-offline-status';
import { MutationQueueManager } from '@/components/offline/mutation-queue-manager';
import { StorageQuotaIndicator } from '@/components/offline/storage-quota';

export function OfflineDashboardPanel() {
  const { pendingMutationCount, storageWarning, isOnline } = useOfflineStatus();
  const [isOpen, setIsOpen] = useState(false);

  const showIndicator = pendingMutationCount > 0 || storageWarning !== 'none' || !isOnline;

  if (!showIndicator && !isOpen) return null;

  return (
    <>
      {/* Floating action button */}
      {!isOpen && showIndicator && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
        >
          {!isOnline ? (
            <WifiOff className="size-4 text-red-500" />
          ) : pendingMutationCount > 0 ? (
            <Upload className="size-4 text-amber-500" />
          ) : (
            <HardDrive className="size-4 text-emerald-500" />
          )}
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {!isOnline ? 'Offline' : `${pendingMutationCount} pending`}
          </span>
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-40 w-full max-w-sm bg-white dark:bg-gray-900 border-t border-l border-gray-200 dark:border-gray-700 rounded-tl-2xl shadow-2xl max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <HardDrive className="size-4" />
              Offline Management
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="size-4 text-gray-500" />
            </button>
          </div>
          <div className="p-3 space-y-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
                <WifiOff className="size-3.5 shrink-0" />
                You are offline — changes will sync when reconnected
              </div>
            )}
            <StorageQuotaIndicator />
            {pendingMutationCount > 0 && <MutationQueueManager />}
          </div>
        </div>
      )}
    </>
  );
}
