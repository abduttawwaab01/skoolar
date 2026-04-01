const CACHE_NAME = 'skoolar-v1';
const OFFLINE_URL = '/offline';

const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
];

const API_CACHE_NAME = 'skoolar-api-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.includes('/auth/') || url.pathname === '/api/schools') {
      event.respondWith(networkFirst(request, API_CACHE_NAME));
      return;
    }
    event.respondWith(networkFirst(request, API_CACHE_NAME));
    return;
  }

  if (request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  if (request.destination === 'font') {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return caches.match('/offline');
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.destination === 'document') {
      return caches.match('/offline');
    }

    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});