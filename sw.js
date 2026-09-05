// Frugalish service worker
// Caches the app shell (this page, icons, and the external libraries it
// loads) so the app can still OPEN with no signal. Live data — Supabase
// sync, statement import — still needs real connectivity; those requests
// are deliberately left untouched here, not cached or served stale.

const CACHE_NAME = 'frugalish-shell-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // best-effort — a slow/missing asset shouldn't block install
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept Supabase API calls — sync and imports need live,
  // uncached responses, and should fail visibly (not silently) if offline.
  if (url.includes('supabase.co') || event.request.method !== 'GET') return;

  // Everything else (this page, the CDN libraries it loads): serve from
  // cache immediately if we have it, and refresh the cache in the
  // background so the next offline open has the latest version.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
