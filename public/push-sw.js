self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Skoolar', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'skoolar-notification',
    requireInteraction: data.requireInteraction ?? true,
    renotify: data.renotify ?? true,
    silent: data.silent ?? false,
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Skoolar', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  const url = data.url || '/dashboard';

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            if (url && client.url !== self.location.origin + url) {
              client.navigate(url);
            }
          });
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function () {
  const url = '/api/push/subscribe';
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'resubscribe' }),
  }).catch(() => {});
});
