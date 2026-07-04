'use client';

import { SessionProvider } from 'next-auth/react';
import { PWAInstallPrompt } from '@/components/pwa/install-prompt';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { OfflineProvider } from '@/components/providers/offline-provider';
import { OfflineBanner } from '@/components/offline/offline-banner';
import { OfflinePrefetcher } from '@/components/offline/offline-prefetcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ErrorBoundary>
        <OfflineProvider>
          <OfflineBanner />
          <OfflinePrefetcher />
          {children}
          <PWAInstallPrompt />
        </OfflineProvider>
      </ErrorBoundary>
    </SessionProvider>
  );
}