// public/sw.js - Apex Grand Prix Next-Gen Offline Service Worker
const CORE_CACHE = 'apex-gp-core-v2';
const PAK_CACHE = 'apex-gp-paks-v2';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Core asset pre-cache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CORE_CACHE && key !== PAK_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests or browser extension protocols
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. .PAK Asset Streaming Cache Strategy (Cache-First with dynamic runtime caching)
  if (url.pathname.includes('/assets/paks/')) {
    event.respondWith(
      caches.open(PAK_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(req);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 206)) {
            // Cache full 200 responses
            if (networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
          }
          return networkResponse;
        } catch {
          // PakStreamer catches 404 or network error and seamlessly builds synthetic pak buffer in-memory
          return new Response(new Uint8Array(0), {
            status: 404,
            statusText: 'Offline Pak Miss - Fallback Available'
          });
        }
      })
    );
    return;
  }

  // 2. Core App Shell Strategy (Stale-While-Revalidate with offline fallback)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CORE_CACHE).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
