'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches;
    }
    return false;
  });
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Detect iOS Safari
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      const dismissedTime = localStorage.getItem('pwa-install-dismissed');
      if (dismissedTime && Date.now() - parseInt(dismissedTime) < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    // For iOS or non-standard browsers, show install instructions after visit count
    if (isIOSDevice || !('BeforeInstallPromptEvent' in window)) {
      const visitCount = parseInt(localStorage.getItem('pwa-visit-count') || '0') + 1;
      localStorage.setItem('pwa-visit-count', visitCount.toString());
      if (visitCount >= 2) {
        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
        if (!dismissedTime || Date.now() - parseInt(dismissedTime) >= 7 * 24 * 60 * 60 * 1000) {
          setTimeout(() => setShowPrompt(true), 5000);
        }
      }
    }

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
    localStorage.removeItem('pwa-install-dismissed');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-emerald-100 dark:border-emerald-900/30 p-4 relative">
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full p-1">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shrink-0">
            <Download className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Install Skoolar</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Get the best experience</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
          {isIOS
            ? 'Tap the Share button <span class="text-base">⎙</span> then scroll down and tap <strong>Add to Home Screen</strong>.'
            : deferredPrompt
              ? 'Install Skoolar for quick access, offline support, and a faster experience.'
              : 'Open the browser menu <span class="text-base">⋮</span> and tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>.'}
        </p>

        <div className="flex gap-2">
          {deferredPrompt ? (
            <Button onClick={handleInstall} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Download className="h-4 w-4" /> Install App
            </Button>
          ) : (
            <Button onClick={handleDismiss} variant="outline" className="flex-1 gap-2">
              <Smartphone className="h-4 w-4" /> Got it
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-gray-500">
            {deferredPrompt ? 'Not now' : 'Dismiss'}
          </Button>
        </div>
      </div>
    </div>
  );
}
