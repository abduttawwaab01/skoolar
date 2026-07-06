'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function ServiceWorkerRegistration() {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    registered.current = true;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        // Push notification handlers are consolidated into sw.js
        // No separate push-sw.js needed

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast.info('Update available', {
                  description: 'A new version is available. Tap to refresh.',
                  action: {
                    label: 'Update',
                    onClick: () => {
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      window.location.reload();
                    },
                  },
                  duration: 10000,
                });
              }
            });
          }
        });

        // Auto-update on controller change
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    };

    window.addEventListener('load', registerSW);
    return () => window.removeEventListener('load', registerSW);
  }, []);

  return null;
}
