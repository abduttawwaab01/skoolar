const CACHE_PREFIX = 'skoolar-cache-';
const API_CACHE_PREFIX = 'skoolar-api-';
const STATIC_CACHE_PREFIX = 'skoolar-static-';

const CACHE_VERSION = 'v2';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const API_CACHE_NAME = API_CACHE_PREFIX + CACHE_VERSION;
const STATIC_CACHE_NAME = STATIC_CACHE_PREFIX + CACHE_VERSION;
const OFFLINE_URL = '/offline';

const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/dashboard',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.svg',
];

const API_CACHEABLE_STATUSES = [200, 201, 304];
const MAX_API_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Install: precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch(() => { /* skip failed */ })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches + take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((n) => (n.startsWith(CACHE_PREFIX) || n.startsWith(API_CACHE_PREFIX) || n.startsWith(STATIC_CACHE_PREFIX)) && n !== CACHE_NAME && n !== API_CACHE_NAME && n !== STATIC_CACHE_NAME)
          .map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: intelligent strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__')) return;

  // CSRF token: network-only — never cache (tokens are one-time-use)
  if (url.pathname === '/api/auth/csrf' || url.pathname === '/api/auth/csrf/') {
    return;
  }

  // Health endpoint: network-only — must always reflect real connectivity
  if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
    return;
  }

  // Auth session: stale-while-revalidate (cached session allows offline dashboard access)
  if (url.pathname.startsWith('/api/auth/')) {
    event.respondWith(apiStrategy(request));
    return;
  }

  // API: Stale-while-revalidate with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiStrategy(request));
    return;
  }

  // Next.js static chunks (_next/static): Cache-first, background update
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstWithNetworkUpdate(request, STATIC_CACHE_NAME));
    return;
  }

  // Images, fonts: Cache-first
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // Documents (pages): Network-first with offline fallback
  if (request.destination === 'document') {
    event.respondWith(networkFirstWithOffline(request, CACHE_NAME));
    return;
  }

  // Scripts, styles: Network-first
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Everything else: Network-first
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// ─── API Strategy (Stale-While-Revalidate with offline-first support) ───
async function apiStrategy(request) {
  const cached = await caches.match(request);
  
  // Return cached immediately if available (fast UI)
  if (cached) {
    // Fire-and-forget: update cache in background
    fetchAndCache(request, API_CACHE_NAME).catch(() => {});
    return cached;
  }

  // No cache: try network
  try {
    const res = await fetch(request);
    if (res.ok && res.status < 300) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    // Fully offline with no cache — return offline error
    return new Response(JSON.stringify({ error: 'offline', message: 'You are offline. Cached data will be shown when available.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
    });
  }
}

async function fetchAndCache(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return null;
  }
}

// ── Caching Strategies ──

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    if (request.destination === 'image') {
      return caches.match('/icon-192.png');
    }
    return new Response('', { status: 503 });
  }
}

async function cacheFirstWithNetworkUpdate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res.ok) {
      caches.open(cacheName).then((cache) => cache.put(request, res));
    }
    return res.clone();
  }).catch(() => null);
  if (cached) {
    fetchPromise.catch(() => {});
    return cached;
  }
  const networkRes = await fetchPromise;
  return networkRes || new Response('', { status: 503 });
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok && res.status < 300) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithOffline(request, cacheName) {
  try {
    const res = await fetch(request);
    // Only cache successful responses, not redirects (would break offline auth)
    if (res.ok && res.status < 300) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
  }
}

// ── Background Sync (offline mutation queue) ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'skoolar-sync') {
    event.waitUntil(syncData());
  }
  if (event.tag === 'skoolar-attendance-sync') {
    event.waitUntil(syncAttendance());
  }
  if (event.tag === 'skoolar-mutations-sync') {
    event.waitUntil(syncMutations());
  }
});

async function syncData() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const keys = await cache.keys();
    await Promise.allSettled(
      keys.map(async (request) => {
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res);
        } catch { /* offline, skip */ }
      })
    );
  } catch { /* skip */ }
}

async function syncAttendance() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('pending', 'readonly');
    const store = tx.objectStore('pending');
    const records = await store.getAll();
    await Promise.allSettled(
      records.map(async (record) => {
        try {
          const res = await fetch('/api/attendance/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
          });
          if (res.ok) {
            const deleteTx = db.transaction('pending', 'readwrite');
            deleteTx.objectStore('pending').delete(record.id);
          }
        } catch { /* skip */ }
      })
    );
  } catch { /* skip */ }
}

// New: Sync mutations from IndexedDB v2
async function syncMutations() {
  let db;
  try {
    db = await openOfflineDBV2();
    const tx = db.transaction('pendingMutations', 'readonly');
    const store = tx.objectStore('pendingMutations');
    const index = store.index('by_status');
    const range = IDBKeyRange.only('pending');
    const mutations = await new Promise((resolve, reject) => {
      const items = [];
      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });

    if (!mutations.length) return;

    // Sort by creation order
    mutations.sort((a, b) => a.createdAt - b.createdAt);

    for (const mutation of mutations) {
      try {
        const headers = { 'Content-Type': 'application/json', 'X-Idempotency-Key': mutation.idempotencyKey || '' };
        const res = await fetch(mutation.url, {
          method: mutation.method,
          headers,
          body: mutation.body ? JSON.stringify(mutation.body) : undefined,
        });
        if (res.ok) {
          const deleteTx = db.transaction('pendingMutations', 'readwrite');
          deleteTx.objectStore('pendingMutations').delete(mutation.id);
        }
      } catch { /* will retry on next sync */ }
    }
    db.close();
  } catch { /* skip */ }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('skoolar-offline', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openOfflineDBV2() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('skoolar-offline-v2', 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Periodic Background Sync ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'skoolar-sync') {
    event.waitUntil(syncData());
  }
  if (event.tag === 'skoolar-mutations-sync') {
    event.waitUntil(syncMutations());
  }
});

// ── Push Notifications (consolidated from push-sw.js) ──
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

// ── Message Handling ──
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      return Promise.all(names.map((n) => caches.delete(n)));
    }).catch(() => {});
  }
  if (event.data?.type === 'QUEUE_ATTENDANCE' && event.data?.record) {
    openOfflineDB().then(db => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').put(event.data.record);
    }).catch(() => {});
  }
});
