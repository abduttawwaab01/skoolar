'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { setGatewayContext } from '@/lib/offline/gateway';
import { setSocketQueueContext } from '@/lib/offline/socket-queue';
import { setFileQueueContext } from '@/lib/offline/file-queue';
import { evictStaleEntities, evictStaleQueryCache } from '@/lib/offline/db';
import { useAppStore } from '@/store/app-store';
import { ConflictResolver } from '@/components/offline/conflict-resolver';
import { MutationQueueManager } from '@/components/offline/mutation-queue-manager';

interface OfflineContextValue {
  ready: boolean;
}

const OfflineContext = createContext<OfflineContextValue>({ ready: false });

export function OfflineProvider({ children }: { children: ReactNode }) {
  const currentUser = useAppStore((s) => s.currentUser);
  const initialized = useRef(false);

  useEffect(() => {
    if (currentUser.schoolId && currentUser.id && !initialized.current) {
      setGatewayContext(currentUser.schoolId, currentUser.id);
      setSocketQueueContext(currentUser.schoolId);
      setFileQueueContext(currentUser.schoolId, currentUser.id);
      initialized.current = true;

      // Run TTL eviction on mount
      evictStaleEntities().catch(() => {});
      evictStaleQueryCache().catch(() => {});
    }
  }, [currentUser.schoolId, currentUser.id]);

  return (
    <OfflineContext.Provider value={{ ready: !!currentUser.schoolId }}>
      {children}
      <ConflictResolver />
    </OfflineContext.Provider>
  );
}

export function useOfflineContext(): OfflineContextValue {
  return useContext(OfflineContext);
}
