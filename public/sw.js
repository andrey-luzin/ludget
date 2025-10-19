/* Simple service worker for offline support and basic caching */
/* eslint-disable no-restricted-globals */
const CACHE_VERSION = 'v1';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== RUNTIME_CACHE) {
        return caches.delete(key);
      }
      return undefined;
    }))).then(() => self.clients.claim())
  );
});

// Navigation requests: network-first, fallback to cache
const handleNavigate = async (request) => {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return caches.match('/');
  }
};

// Static assets: cache-first
const handleAsset = async (request) => {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  // Cache static assets (CSS/JS/images/fonts)
  if (request.destination && ['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(handleAsset(request));
  }
});

