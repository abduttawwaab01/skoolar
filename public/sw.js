const CACHE_PREFIX = 'skoolar-cache-';
const API_CACHE_PREFIX = 'skoolar-api-';

// Generate a cache version based on build timestamp (injected at build time)
// Falls back to a timestamp if BUILD_ID is not set
const CACHE_VERSION = (typeof BUILD_ID !== 'undefined' && BUILD_ID) || 'v' + Date.now();
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const API_CACHE_NAME = API_CACHE_PREFIX + CACHE_VERSION;
const OFFLINE_URL = '/offline';

// Assets that are part of the initial shell (HTML, manifest, icons)
const SHELL_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
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

  // API requests: network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
    return;
  }

  // HTML documents: network first to always get fresh HTML referencing correct chunks
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Scripts and styles: also network first to avoid stale references
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Images, fonts, and other static assets: cache first for performance
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Default: network first
  event.respondWith(networkFirst(request, CACHE_NAME));
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
    // For non-critical assets, return a fallback if available
    if (request.destination === 'image') {
      return caches.match('/icon-192.png'); // fallback icon
    }
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
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Offline fallback for pages
    if (request.destination === 'document') {
      return caches.match('/offline');
    }

    // For other assets, return a generic response or offline page
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});