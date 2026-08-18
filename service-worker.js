// Caches the app shell so Mizan opens and works offline. It never intercepts
// or touches your financial data — that lives in IndexedDB, which this file
// cannot see.

const CACHE_NAME = 'mizan-v8';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/format.js',
  './js/charts.js',
  './js/ui.js',
  './js/icons.js',
  './js/budget-logic.js',
  './js/networth-logic.js',
  './js/subscription-logic.js',
  './js/transaction-form.js',
  './js/category-form.js',
  './js/account-form.js',
  './js/subscription-form.js',
  './js/router.js',
  './js/main.js',
  './js/views/dashboard.js',
  './js/views/transactions.js',
  './js/views/budget.js',
  './js/views/subscriptions.js',
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

// Network-first, falling back to cache: when you're online (the common case),
// you always get what's actually on the server, so an update is visible on
// the very next reload instead of the reload after that. Offline, it falls
// back to whatever was last cached, which is what keeps the app usable with
// no connection at all.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
