'use client';

import { WifiOff, Home, RefreshCw, School, Clock, Database, MessageSquare, Upload, HardDrive, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { getStorageInfo, getDistinctEntityTypes, clearEntityCache, clearQueryCache, clearEntitiesByType, getPendingMutations, countPendingMutations } from '@/lib/offline/db';
import { triggerSync } from '@/lib/offline/sync-engine';
import { MutationQueueManager } from '@/components/offline/mutation-queue-manager';
import { StorageQuotaIndicator } from '@/components/offline/storage-quota';

export default function OfflinePage() {
  const [cachedPages, setCachedPages] = useState<string[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number | null; entityCount: number; mutationCount: number } | null>(null);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCacheDetail, setShowCacheDetail] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const info = await getStorageInfo();
      setStorageInfo(info);
      const types = await getDistinctEntityTypes();
      setEntityTypes(types);
      const count = await countPendingMutations();
      setPendingCount(count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if ('caches' in window) {
      caches.keys().then(names => {
        setCachedPages(names.filter(n => n.includes('skoolar')));
      });
    }
    loadData();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  const handleTryReconnect = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      if (res.ok) window.location.reload();
    } catch { /* still offline */ }
  }, []);

  const handleClearEntityType = useCallback(async (entityType: string) => {
    await clearEntitiesByType(entityType);
    await loadData();
  }, [loadData]);

  const handleClearAll = useCallback(async () => {
    await clearEntityCache();
    await clearQueryCache();
    await loadData();
    setCachedPages([]);
  }, [loadData]);

  const handleSync = useCallback(async () => {
    if (!isOnline) return;
    await triggerSync();
    await loadData();
  }, [isOnline, loadData]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950 dark:via-gray-950 dark:to-teal-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-emerald-100 dark:border-emerald-900/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <School className="size-5" />
          </div>
          <h1 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Skoolar</h1>
          <div className="ml-auto">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <WifiOff className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            You&apos;re offline
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {isOnline ? 'Connected — cached data is shown' : 'Changes will sync when reconnected'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <Button onClick={handleTryReconnect} className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm">
            <RefreshCw className="size-4" /> Retry Connection
          </Button>
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full gap-2" size="sm">
              <Home className="size-4" /> Go to Dashboard
            </Button>
          </Link>
          {isOnline && pendingCount > 0 && (
            <Button onClick={handleSync} variant="outline" className="gap-2" size="sm">
              <Upload className="size-4" /> Sync ({pendingCount})
            </Button>
          )}
        </div>

        {/* Storage & Cache */}
        <Card className="mb-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur">
          <CardContent className="p-4">
            <StorageQuotaIndicator />
          </CardContent>
        </Card>

        {/* Pending Mutations */}
        {pendingCount > 0 && (
          <Card className="mb-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur border-amber-200 dark:border-amber-800/50">
            <CardContent className="p-4">
              <MutationQueueManager />
            </CardContent>
          </Card>
        )}

        {/* Cached Entities by Type */}
        {entityTypes.length > 0 && (
          <Card className="mb-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur">
            <CardContent className="p-4">
              <button
                onClick={() => setShowCacheDetail(!showCacheDetail)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Database className="size-4" />
                  Cached Data ({entityTypes.length} types)
                </span>
                <Eye className={`size-4 text-gray-400 transition-transform ${showCacheDetail ? 'rotate-180' : ''}`} />
              </button>

              {showCacheDetail && (
                <div className="mt-3 space-y-1">
                  {entityTypes.map((type) => (
                    <div key={type} className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type.replace(/-/g, ' ')}</span>
                      <button
                        onClick={() => handleClearEntityType(type)}
                        className="text-xs text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Clear
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleClearAll}
                    className="w-full mt-2 text-xs text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="size-3" /> Clear All Cached Data
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cache Groups */}
        {cachedPages.length > 0 && (
          <Card className="mb-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="size-4 text-emerald-600" />
                <span className="text-gray-700 dark:text-gray-300">{cachedPages.length} service worker cache groups</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        <div className="space-y-2 mb-4">
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur">
            <CardContent className="p-3 flex items-center gap-3">
              <Clock className="size-4 text-emerald-600 shrink-0" />
              <div className="text-left text-xs">
                <p className="font-medium text-gray-900 dark:text-gray-100">Previously loaded data</p>
                <p className="text-gray-500">Cached pages and API data are available offline</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur">
            <CardContent className="p-3 flex items-center gap-3">
              <Upload className="size-4 text-emerald-600 shrink-0" />
              <div className="text-left text-xs">
                <p className="font-medium text-gray-900 dark:text-gray-100">Pending changes</p>
                <p className="text-gray-500">{pendingCount > 0 ? `${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued for sync` : 'No pending changes'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 text-center flex items-center justify-center gap-1.5 mt-auto pt-4">
          <School className="size-3" />
          Skoolar PWA — Offline Mode
        </p>
      </main>
    </div>
  );
}
