'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { countPendingMutations } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/sync-engine';

interface OfflineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  pendingMutationCount: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  storageUsage: string | null;
}

const STORAGE_KEY = 'skoolar-last-synced';

function getLastSyncedAt(): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(STORAGE_KEY);
  return val ? parseInt(val, 10) : null;
}

function setLastSyncedAt(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAtState] = useState<number | null>(getLastSyncedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageUsage, setStorageUsage] = useState<string | null>(null);
  const wasOfflineRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await countPendingMutations();
      setPendingMutationCount(count);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  const refreshStorageUsage = useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          setStorageUsage(formatBytes(estimate.usage));
        }
      }
    } catch {
      // storage API not available
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      wasOfflineRef.current = true;

      syncEngine.syncAll().then((result) => {
        if (result.synced > 0 || result.failed > 0 || result.conflicts > 0) {
          setLastSyncedAtState(Date.now());
          setLastSyncedAt();
        }
        refreshPendingCount();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshPendingCount, 10000);

    const initialTimer = setTimeout(() => {
      refreshPendingCount();
      refreshStorageUsage();
    }, 0);

    const unsubscribe = syncEngine.on((event) => {
      if (event === 'start') setIsSyncing(true);
      if (event === 'complete' || event === 'error') {
        setIsSyncing(false);
        refreshPendingCount();
        setLastSyncedAtState(Date.now());
        setLastSyncedAt();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      clearTimeout(initialTimer);
      unsubscribe();
    };
  }, [refreshPendingCount, refreshStorageUsage]);

  return {
    isOnline,
    wasOffline,
    pendingMutationCount,
    lastSyncedAt,
    isSyncing,
    storageUsage,
  };
}
