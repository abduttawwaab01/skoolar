'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/app-store';

interface PWANativeOptions {
  onBack?: () => void;
  modalOpen?: boolean;
  onModalClose?: () => void;
}

export function usePWANative({ onBack, modalOpen, onModalClose }: PWANativeOptions = {}) {
  const bodyScrollPosition = useRef(0);

  // ── 1. Scroll Lock for Modals ──
  useEffect(() => {
    if (!modalOpen) {
      document.body.classList.remove('scroll-locked');
      // Restore scroll position
      if (bodyScrollPosition.current > 0) {
        window.scrollTo(0, bodyScrollPosition.current);
      }
      return;
    }

    bodyScrollPosition.current = window.scrollY;
    document.body.classList.add('scroll-locked');
    document.body.style.top = `-${bodyScrollPosition.current}px`;

    return () => {
      document.body.classList.remove('scroll-locked');
      document.body.style.top = '';
    };
  }, [modalOpen]);

  // ── 2. Hardware Back Button (Android) ──
  useEffect(() => {
    if (!onBack) return;

    const handler = () => {
      if (modalOpen && onModalClose) {
        onModalClose();
        return;
      }
      onBack();
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [onBack, modalOpen, onModalClose]);

  // ── 3. App Badge (Notification Count) ──
  const setBadge = useCallback(async (count: number) => {
    try {
      if ('setAppBadge' in navigator) {
        await (navigator as any).setAppBadge(count);
      }
    } catch {
      // Badging API not supported or permission denied
    }
  }, []);

  const clearBadge = useCallback(async () => {
    try {
      if ('clearAppBadge' in navigator) {
        await (navigator as any).clearAppBadge();
      }
    } catch {
      // ignore
    }
  }, []);

  // ── 4. Periodic Background Sync Registration ──
  useEffect(() => {
    const registerPeriodicSync = async () => {
      if (!('serviceWorker' in navigator) || !('periodicSync' in (navigator as any).serviceWorker)) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const status = await (navigator as any).permissions.query({
          name: 'periodic-background-sync',
        });

        if (status.state === 'granted') {
          await (registration as any).periodicSync.register('skoolar-sync', {
            minInterval: 24 * 60 * 60 * 1000, // Once per day
          });
        }
      } catch {
        // Periodic sync not available
      }
    };

    registerPeriodicSync();
  }, []);

  // ── 5. Detect Standalone / PWA mode ──
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );

  // ── 6. Keep Screen On (for active sessions) ──
  const keepScreenOn = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Wake lock not available
    }
  }, []);

  return {
    setBadge,
    clearBadge,
    isStandalone,
    keepScreenOn,
  };
}
