'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
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

  useEffect(() => {
    const handler = (e: Event) => {
      // Don't call preventDefault() - let the browser handle the event naturally
      // We only need to capture the prompt for our custom UI
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
        return; // User recently dismissed, don't show
      }
      
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 5000);
    };

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
    
    // Call prompt() to show the browser's install banner
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
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border p-4 relative">
        <button onClick={handleDismiss} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Download className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Install Skoolar</h3>
            <p className="text-xs text-gray-500">Get the app on your device</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Install Skoolar for quick access, offline support, and a native app experience.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleInstall} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Download className="h-4 w-4" /> Install App
          </Button>
          <Button variant="outline" size="sm" onClick={handleDismiss}>Later</Button>
        </div>
      </div>
    </div>
  );
}
