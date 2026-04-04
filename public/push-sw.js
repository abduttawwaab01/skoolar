/* eslint-disable no-restricted-globals */
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
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || [],
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Skoolar', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'view') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow(data.url || '/dashboard');
      })
    );
  } else {
    event.waitUntil(
      clients.openWindow(data.url || '/dashboard')
    );
  }
});

self.addEventListener('pushsubscriptionchange', function () {
  // Subscription expired - client will need to re-subscribe
  console.log('Push subscription changed');
});
