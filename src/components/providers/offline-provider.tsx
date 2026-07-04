'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { setGatewayContext } from '@/lib/offline/gateway';
import { useAppStore } from '@/store/app-store';

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
      initialized.current = true;
    }
  }, [currentUser.schoolId, currentUser.id]);

  return (
    <OfflineContext.Provider value={{ ready: !!currentUser.schoolId }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext(): OfflineContextValue {
  return useContext(OfflineContext);
}
