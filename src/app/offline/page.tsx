'use client';

import { WifiOff, Home, RefreshCw, School, Clock, Database, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function OfflinePage() {
  const [cachedPages, setCachedPages] = useState<string[]>([]);

  useEffect(() => {
    if ('caches' in window) {
      caches.keys().then(names => {
        setCachedPages(names.filter(n => n.includes('skoolar')));
      });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950 dark:via-gray-950 dark:to-teal-950">
      {/* App-like header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-emerald-100 dark:border-emerald-900/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <School className="size-5" />
          </div>
          <h1 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Skoolar</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-6 shadow-inner">
            <WifiOff className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            You&apos;re offline
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm leading-relaxed">
            Your internet connection was lost. Don&apos;t worry — some features may still work from cached data.
          </p>

          <div className="space-y-3 mb-8">
            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-emerald-100 dark:border-emerald-900/30">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="size-5 text-emerald-600 shrink-0" />
                <div className="text-left text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">Previously loaded data</p>
                  <p className="text-xs text-gray-500">Cached pages and data are available</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-emerald-100 dark:border-emerald-900/30">
              <CardContent className="p-4 flex items-center gap-3">
                <MessageSquare className="size-5 text-emerald-600 shrink-0" />
                <div className="text-left text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100">Reconnect to continue</p>
                  <p className="text-xs text-gray-500">Auto-reconnect when connection is restored</p>
                </div>
              </CardContent>
            </Card>

            {cachedPages.length > 0 && (
              <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-emerald-100 dark:border-emerald-900/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <Database className="size-5 text-emerald-600 shrink-0" />
                  <div className="text-left text-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Cache active</p>
                    <p className="text-xs text-gray-500">{cachedPages.length} cache groups available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => window.location.reload()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <RefreshCw className="size-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline" className="gap-2">
                <Home className="size-4" />
                Go to Home
              </Button>
            </Link>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-600 mt-10 flex items-center justify-center gap-1.5">
            <School className="size-3" />
            Skoolar PWA — Offline Mode
          </p>
        </div>
      </main>
    </div>
  );
}
