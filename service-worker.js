// Caches the app shell so Mizan opens and works offline. It never intercepts
// or touches your financial data — that lives in IndexedDB, which this file
// cannot see.

const CACHE_NAME = 'mizan-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/format.js',
  './js/charts.js',
  './js/ui.js',
  './js/budget-logic.js',
  './js/networth-logic.js',
  './js/transaction-form.js',
  './js/category-form.js',
  './js/account-form.js',
  './js/router.js',
  './js/main.js',
  './js/views/dashboard.js',
  './js/views/track.js',
  './js/views/transactions.js',
  './js/views/budget.js',
  './js/views/insights.js',
  './js/views/networth.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve from cache instantly, refresh in the
// background so the next load picks up changes.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
