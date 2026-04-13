'use client';

import { GlobalPreloader } from '@/components/preloader/global-preloader';

export function PreloaderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalPreloader />
      {children}
    </>
  );
}