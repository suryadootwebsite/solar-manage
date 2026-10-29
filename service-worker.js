/**
 * service-worker.js — Solar MS PWA Service Worker.
 *
 * Cache Strategy:
 *   - Network-First (fallback to cache) for index.html, JS, CSS, locales, icons.
 *     Ensures fresh deployments are picked up immediately on deploy.
 *   - Network-Only for Google Apps Script API calls (never cached).
 *   - Cache name derived from APP_VERSION and automatically bumped on version upgrade.
 *
 * Doc ref: Doc 06 §1, Doc 09 S03
 */

const APP_VERSION = '1.0.0';
const CACHE_NAME = 'solar-ms-shell-v' + APP_VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './css/theme.css',
  './css/base.css',
  './css/components.css',
  './js/config.js',
  './js/auth.js',
  './js/i18n.js',
  './js/ui.js',
  './js/api.js',
  './js/pages/ping.js',
  './js/pages/login.js',
  './js/pages/users.js',
  './js/pages/settings.js',
  './js/components/master-cache.js',
  './js/components/search-select.js',
  './js/components/serial-input.js',
  './js/components/list-search.js',
  './js/components/doc-manager.js',
  './js/pages/dashboard.js',
  './js/pages/customers.js',
  './js/pages/masters.js',
  './js/pages/lots.js',
  './js/pages/stock.js',
  './js/pages/transfers.js',
  './js/pages/import-stock.js',
  './js/pages/sites.js',
  './js/pages/site-detail.js',
  './js/pages/leads.js',
  './js/pages/reports.js',
  './js/pages/money.js',
  './js/pages/material-issue.js',
  './js/pages/serial-register.js',
  './js/router.js',
  './js/app.js',
  './locales/en.json',
  './locales/hi.json'
];

// Install: pre-cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: purge old cache versions on version bump
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First with cache fallback for shell; Network-Only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API calls: NEVER CACHE (always live network)
  if (url.origin.includes('script.google.com') || url.origin.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Shell Assets: Network-First with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If network fetch succeeds, update cache in background
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET' && url.origin === self.location.origin) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed (offline) -> fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If navigation request and not specifically in cache, serve cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
