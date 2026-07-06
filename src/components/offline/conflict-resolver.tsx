'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Download, Upload, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { syncEngine } from '@/lib/offline/sync-engine';
import { cacheEntity, removeMutation } from '@/lib/offline/db';
import type { PendingMutation, MutationConflict } from '@/lib/offline/types';

export function ConflictResolver() {
  const [conflicts, setConflicts] = useState<MutationConflict[]>([]);
  const [activeConflict, setActiveConflict] = useState<MutationConflict | null>(null);

  useEffect(() => {
    const unsubscribe = syncEngine.on((event, data) => {
      if (event === 'conflict' && data) {
        const { mutation, serverData } = data as { mutation: PendingMutation; serverData: unknown };
        const conflict: MutationConflict = {
          mutation,
          localData: mutation.body,
          serverData,
          resolved: false,
        };
        setConflicts((prev) => [...prev, conflict]);
        setActiveConflict(conflict);
      }
    });
    return unsubscribe;
  }, []);

  const resolveKeepLocal = useCallback(async (conflict: MutationConflict) => {
    try {
      await removeMutation(conflict.mutation.id);
      conflict.resolved = true;
      conflict.resolution = 'keep-local';
      conflict.resolvedAt = Date.now();
      setConflicts((prev) => prev.map((c) => c.mutation.id === conflict.mutation.id ? conflict : c));
      setActiveConflict(null);
    } catch { /* ignore */ }
  }, []);

  const resolveKeepServer = useCallback(async (conflict: MutationConflict) => {
    try {
      const entityId = extractEntityId(conflict.mutation.url);
      if (entityId && conflict.mutation.entityType) {
        const serverData = (conflict.serverData as any)?.data || (conflict.serverData as any)?.serverData || conflict.serverData;
        await cacheEntity(conflict.mutation.entityType, entityId, conflict.mutation.schoolId, serverData, Date.now());
      }
      await removeMutation(conflict.mutation.id);
      conflict.resolved = true;
      conflict.resolution = 'keep-server';
      conflict.resolvedAt = Date.now();
      setConflicts((prev) => prev.map((c) => c.mutation.id === conflict.mutation.id ? conflict : c));
      setActiveConflict(null);
    } catch { /* ignore */ }
  }, []);

  if (conflicts.length === 0) return null;

  return (
    <>
      {activeConflict && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-amber-200 dark:border-amber-800 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-amber-100 dark:border-amber-800/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-600" />
                <h3 className="font-bold text-gray-900 dark:text-white">Sync Conflict</h3>
              </div>
              <button onClick={() => setActiveConflict(null)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="size-4 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>There was a conflict while syncing changes for <strong className="text-gray-900 dark:text-white">{activeConflict.mutation.entityType}</strong>.</p>
                <p className="mt-1">Both your local changes and the server have different versions.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                    <Upload className="size-3" /> Your Changes
                  </p>
                  <pre className="text-xs text-blue-600 dark:text-blue-400 overflow-auto max-h-32 whitespace-pre-wrap">
                    {JSON.stringify(activeConflict.localData, null, 2)}
                  </pre>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
                    <Download className="size-3" /> Server Version
                  </p>
                  <pre className="text-xs text-emerald-600 dark:text-emerald-400 overflow-auto max-h-32 whitespace-pre-wrap">
                    {JSON.stringify(activeConflict.serverData, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-500 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <strong>URL:</strong> {activeConflict.mutation.url}<br />
                <strong>Method:</strong> {activeConflict.mutation.method}<br />
                <strong>Created:</strong> {new Date(activeConflict.mutation.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-amber-100 dark:border-amber-800/50">
              <Button onClick={() => resolveKeepLocal(activeConflict)} variant="outline" className="flex-1 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300">
                <Upload className="size-4" /> Keep Mine
              </Button>
              <Button onClick={() => resolveKeepServer(activeConflict)} variant="outline" className="flex-1 gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300">
                <Download className="size-4" /> Keep Server
              </Button>
            </div>
          </div>
        </div>
      )}

      {!activeConflict && conflicts.filter(c => !c.resolved).length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={() => setActiveConflict(conflicts.find(c => !c.resolved) || null)} className="bg-amber-600 hover:bg-amber-700 gap-2 shadow-lg">
            <AlertTriangle className="size-4" />
            {conflicts.filter(c => !c.resolved).length} unresolved conflict{conflicts.filter(c => !c.resolved).length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </>
  );
}

function extractEntityId(url: string): string | null {
  try {
    const path = new URL(url, window.location.origin).pathname;
    const parts = path.split('/').filter(Boolean);
    return parts.length >= 3 ? parts[2] : null;
  } catch {
    return null;
  }
}
