const CACHE_PREFIX = 'skoolar-cache-';
const API_CACHE_PREFIX = 'skoolar-api-';
const STATIC_CACHE_PREFIX = 'skoolar-static-';

const CACHE_VERSION = 'v1';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const API_CACHE_NAME = API_CACHE_PREFIX + CACHE_VERSION;
const STATIC_CACHE_NAME = STATIC_CACHE_PREFIX + CACHE_VERSION;
const OFFLINE_URL = '/offline';

const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.svg',
];

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

// Activate: clean old caches
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

  if (request.method !== 'GET') return;

  // Skip non-origin requests
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__')) return;

  // API: Network first, cache fallback (stale-while-revalidate style)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithRevalidate(request, API_CACHE_NAME));
    return;
  }

  // Next.js static chunks (_next/static): Cache first, network update
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstWithNetworkUpdate(request, STATIC_CACHE_NAME));
    return;
  }

  // Images, fonts: Cache first
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // Documents (pages): Network first
  if (request.destination === 'document') {
    event.respondWith(networkFirstWithOffline(request, CACHE_NAME));
    return;
  }

  // Scripts, styles: Network first
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Everything else: Network first
  event.respondWith(networkFirst(request, CACHE_NAME));
});

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
    // Return cached immediately, update in background
    fetchPromise.catch(() => {});
    return cached;
  }
  const networkRes = await fetchPromise;
  return networkRes || new Response('', { status: 503 });
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function networkFirstWithOffline(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
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

// ── Background Sync (offline queue) ──
self.addEventListener('sync', (event) => {
  if (event.tag === 'skoolar-sync') {
    event.waitUntil(syncData());
  }
  if (event.tag === 'skoolar-attendance-sync') {
    event.waitUntil(syncAttendance());
  }
});

async function syncData() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const keys = await cache.keys();
    // Refresh cached API data in background
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
  // Attempt to flush any queued attendance records from IndexedDB
  try {
    const db = await openAttendanceDB();
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

function openAttendanceDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('skoolar-offline', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Periodic Background Sync ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'skoolar-sync') {
    event.waitUntil(syncData());
  }
});

// ── Message Handling ──
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      return Promise.all(names.map((n) => caches.delete(n)));
    });
  }
  if (event.data?.type === 'QUEUE_ATTENDANCE' && event.data?.record) {
    // Store attendance record for offline sync
    openAttendanceDB().then(db => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').put(event.data.record);
    });
  }
});
