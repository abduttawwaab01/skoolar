'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { useAppStore } from '@/store/app-store';
import { createIndexedDbPersister } from '@/lib/offline/persister';
import { syncEngine, triggerSync } from '@/lib/offline/sync-engine';
import { getPendingMutations, evictStaleEntities, evictStaleQueryCache } from '@/lib/offline/db';
import { flushSocketQueue } from '@/lib/offline/socket-queue';
import { processFileUploads } from '@/lib/offline/file-queue';

const MAX_RETENTION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        refetchOnMount: false,
      },
      mutations: {
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const schoolId = useAppStore((s) => s.currentUser.schoolId);
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    if (!schoolId) return;

    const persister = createIndexedDbPersister(schoolId);

    const hydrate = async () => {
      // Run TTL eviction
      try {
        await evictStaleEntities();
        await evictStaleQueryCache();
      } catch { /* ignore */ }

      // Restore persisted query cache
      try {
        const client = await persister.restoreClient();
        if (client) {
          const now = Date.now();
          Object.entries(client.clientState.queries).forEach(([, query]: [string, any]) => {
            try {
              if (now - (query.updatedAt || 0) < MAX_RETENTION_AGE && query.state?.data) {
                const qKey = JSON.parse(query.queryKey);
                queryClient.setQueryData(qKey, query.state.data);
              }
            } catch { /* skip malformed query */ }
          });
        }
      } catch {
        // Cache restoration failed — start fresh
      }

      // Sync any pending mutations from previous session
      const pending = await getPendingMutations(schoolId);
      if (pending.length > 0) {
        syncEngine.syncAll(schoolId);
      }
    };

    hydrate();

    // Online event: trigger full sync (mutations + socket events + file uploads)
    const handleOnline = async () => {
      await triggerSync(schoolId);
      // Socket and file queue processing would need socket reference
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [schoolId, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}