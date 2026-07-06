'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Trash2, AlertTriangle, Clock, Upload, FileText, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPendingMutations, removeMutation, countPendingMutations } from '@/lib/offline/db';
import { triggerSync } from '@/lib/offline/sync-engine';
import { useOfflineStatus } from '@/hooks/use-offline-status';
import type { PendingMutation } from '@/lib/offline/types';

export function MutationQueueManager() {
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { isOnline, pendingMutationCount } = useOfflineStatus();

  const loadMutations = useCallback(async () => {
    try {
      const all = await getPendingMutations();
      all.sort((a, b) => b.createdAt - a.createdAt);
      setMutations(all);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (pendingMutationCount > 0) loadMutations();
    else setMutations([]);
  }, [pendingMutationCount, loadMutations]);

  const handleSync = useCallback(async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      await triggerSync();
      await loadMutations();
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing, loadMutations]);

  const handleRemove = useCallback(async (id: string) => {
    await removeMutation(id);
    await loadMutations();
  }, [loadMutations]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="size-3.5 text-amber-500" />;
      case 'failed': return <AlertTriangle className="size-3.5 text-red-500" />;
      case 'conflict': return <AlertTriangle className="size-3.5 text-orange-500" />;
      case 'synced': return <CheckCircle className="size-3.5 text-emerald-500" />;
      default: return <Clock className="size-3.5 text-gray-400" />;
    }
  };

  if (mutations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Upload className="size-4" />
          Pending Changes ({mutations.length})
        </h4>
        <Button onClick={handleSync} disabled={!isOnline || syncing} size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
          <RefreshCw className={`size-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {mutations.map((mutation) => (
          <div key={mutation.id} className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === mutation.id ? null : mutation.id)}
              className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left"
            >
              {getStatusIcon(mutation.status)}
              <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">{mutation.method}</span>
              <span className="text-gray-500 dark:text-gray-400 truncate flex-1">{mutation.entityType}</span>
              <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {new Date(mutation.createdAt).toLocaleTimeString()}
              </span>
              {expandedId === mutation.id ? <EyeOff className="size-3 text-gray-400" /> : <Eye className="size-3 text-gray-400" />}
            </button>

            {expandedId === mutation.id && (
              <div className="px-2 pb-2 space-y-1">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-1.5">
                  <p className="text-[10px] text-gray-400 mb-0.5">URL</p>
                  <p className="text-gray-600 dark:text-gray-400 break-all">{mutation.url}</p>
                </div>
                {mutation.body ? (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-1.5">
                    <p className="text-[10px] text-gray-400 mb-0.5">Body</p>
                    <pre className="text-gray-600 dark:text-gray-400 overflow-auto max-h-20 whitespace-pre-wrap">
                      {JSON.stringify(mutation.body, null, 2)}
                    </pre>
                  </div>
                ) : null}
                {mutation.error && (
                  <div className="bg-red-50 dark:bg-red-950/30 rounded p-1.5">
                    <p className="text-[10px] text-red-400 mb-0.5">Error</p>
                    <p className="text-red-600 dark:text-red-400">{mutation.error}</p>
                  </div>
                )}
                <div className="flex gap-1 pt-1">
                  {isOnline && mutation.status !== 'synced' && (
                    <Button onClick={() => { handleSync(); }} size="sm" variant="ghost" className="h-6 text-xs gap-1">
                      <RefreshCw className="size-3" /> Retry
                    </Button>
                  )}
                  <Button onClick={() => handleRemove(mutation.id)} size="sm" variant="ghost" className="h-6 text-xs gap-1 text-red-500 hover:text-red-700">
                    <Trash2 className="size-3" /> Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
