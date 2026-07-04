'use client';

import { useEffect, useState } from 'react';
import { getStorageInfo } from '@/lib/offline/db';
import { clearEntityCache, clearQueryCache } from '@/lib/offline/db';
import { Database, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StorageInfo {
  usage: number;
  quota: number | null;
  entityCount: number;
  mutationCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function StorageQuotaIndicator() {
  const [info, setInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const info = await getStorageInfo();
        setInfo(info);
      } catch { /* ignore */ }
    };
    load();
  }, []);

  if (!info) return null;

  const percentFull = info.quota ? Math.round((info.usage / info.quota) * 100) : 0;
  const isLow = percentFull > 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <Database className="size-3.5" />
          Offline Storage
        </span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {formatBytes(info.usage)}{info.quota ? ` / ${formatBytes(info.quota)}` : ''}
        </span>
      </div>
      {info.quota && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              isLow ? 'bg-red-500' : percentFull > 60 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(percentFull, 100)}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
        <span>{info.entityCount} cached records</span>
        {info.mutationCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400">{info.mutationCount} pending sync</span>
        )}
      </div>
      {isLow && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="size-3" />
          <span>Storage is running low</span>
        </div>
      )}
    </div>
  );
}

export function ClearOfflineDataButton() {
  const [cleared, setCleared] = useState(false);

  const handleClear = async () => {
    if (!confirm('Clear all offline cached data? Pending changes will be lost.')) return;
    await clearEntityCache();
    await clearQueryCache();
    setCleared(true);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClear}
      disabled={cleared}
      className="gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700"
    >
      <Trash2 className="size-3.5" />
      {cleared ? 'Cleared' : 'Clear Offline Data'}
    </Button>
  );
}
