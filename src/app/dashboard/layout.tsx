'use client';

import { SessionProvider } from 'next-auth/react';
import { PWAInstallPrompt } from '@/components/pwa/install-prompt';
import { ErrorBoundary } from '@/components/shared/error-boundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ErrorBoundary>
        {children}
        <PWAInstallPrompt />
      </ErrorBoundary>
    </SessionProvider>
  );
}