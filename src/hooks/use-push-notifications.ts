'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    checkSubscription();
  }, [isSupported]);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Notification permission denied');
        return;
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js');
      await registration.update();

      const res = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await res.json();

      if (!publicKey) {
        toast.error('VAPID key not configured');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      setIsSubscribed(true);
      toast.success('Push notifications enabled!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to subscribe';
      toast.error(msg);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unsubscribe';
      toast.error(msg);
    }
  }, []);

  return { isSupported, permission, isSubscribed, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
