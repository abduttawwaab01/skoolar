'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, type ReactNode } from 'react';
import { useAppStore } from '@/store/app-store';
import { createIndexedDbPersister } from '@/lib/offline/persister';
import { syncEngine, triggerSync } from '@/lib/offline/sync-engine';
import { getPendingMutations } from '@/lib/offline/db';

const MAX_RETENTION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        refetchOnMount: false,
      },
      mutations: {
        retry: 1,
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
      try {
        const client = await persister.restoreClient();
        if (client) {
          const now = Date.now();
          const validQueries = Object.fromEntries(
            Object.entries(client.clientState.queries).filter(([, query]: [string, any]) => {
              return now - (query.updatedAt || 0) < MAX_RETENTION_AGE;
            })
          );
          if (Object.keys(validQueries).length > 0) {
            queryClient.setQueryData(
              validQueries as any
            );
          }
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

    // Online event: trigger sync
    const handleOnline = () => triggerSync(schoolId);
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [schoolId, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}