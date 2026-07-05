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
const PROBE_URL = '/api/health';
const PROBE_INTERVAL = 30000;
const PROBE_TIMEOUT = 5000;

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

async function probeConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
    const res = await fetch(PROBE_URL, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAtState] = useState<number | null>(getLastSyncedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageUsage, setStorageUsage] = useState<string | null>(null);
  const probeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProbeRef = useRef<boolean | null>(null);

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

  const goOnline = useCallback(() => {
    setIsOnline((prev) => {
      if (!prev) setWasOffline(true);
      return true;
    });
  }, []);

  const goOffline = useCallback(() => {
    setIsOnline((prev) => {
      if (prev) setWasOffline(false);
      return false;
    });
  }, []);

  // Run a connectivity probe and set online/offline based on real result
  const checkConnectivity = useCallback(async () => {
    const connected = await probeConnectivity();
    lastProbeRef.current = connected;

    if (connected) {
      goOnline();
    } else if (!navigator.onLine) {
      goOffline();
    }
    // If probe says offline but navigator.onLine says online, stay online
    // (transient blip — probe may have hit a delayed response)

    return connected;
  }, [goOnline, goOffline]);

  useEffect(() => {
    // Browser online/offline events are unreliable (false negatives on Windows, etc.)
    // So we run our own connectivity probe on mount + periodically.
    // The browser events are still used as hints to trigger a probe faster,
    // but actual state is determined by the probe result.

    const handleBrowserOnline = () => {
      checkConnectivity().then((connected) => {
        if (connected) {
          syncEngine.syncAll().then((result) => {
            if (result.synced > 0 || result.failed > 0 || result.conflicts > 0) {
              setLastSyncedAtState(Date.now());
              setLastSyncedAt();
            }
            refreshPendingCount();
          });
        }
      });
    };

    const handleBrowserOffline = () => {
      // Browser says offline — verify with a probe immediately
      checkConnectivity().then((connected) => {
        if (!connected) {
          goOffline();
        }
      });
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    const probeInterval = setInterval(() => {
      checkConnectivity();
    }, PROBE_INTERVAL);

    probeRef.current = probeInterval;

    const pendingInterval = setInterval(refreshPendingCount, 10000);

    // Wrapped in setTimeout to avoid synchronous setState in effect body
    const initTimer = setTimeout(() => {
      checkConnectivity();
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
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      clearInterval(probeInterval);
      clearInterval(pendingInterval);
      clearTimeout(initTimer);
      unsubscribe();
    };
  }, [checkConnectivity, goOnline, goOffline, refreshPendingCount, refreshStorageUsage]);

  return {
    isOnline,
    wasOffline,
    pendingMutationCount,
    lastSyncedAt,
    isSyncing,
    storageUsage,
  };
}
