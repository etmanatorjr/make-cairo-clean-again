/* ==========================================================================
   sw.js — service worker (makes the app a PWA that opens offline).
   - On install: saves the app files (the "app shell") in a cache.
   - App files: network first (always fresh when online), cache when offline.
   - Google Fonts: cache first.
   - /api and Open-Meteo: never cached here (the app handles offline itself).
   Change VERSION when you change the app so old caches are deleted.
   ========================================================================== */
const VERSION = 'mcca-v15';
const SHELL = [
  './',
  'index.html',
  'css/styles.css',
  'js/config.js',
  'js/rules.js',
  'js/storage.js',
  'js/api.js',
  'js/data.js',
  'js/router.js',
  'js/air.js',
  'js/quiz.js',
  'js/game.js',
  'js/actions.js',
  'js/leaderboard.js',
  'js/native.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'images/sdg-goal-11.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API calls and live air data: let the app handle them
  if (url.pathname.startsWith('/api/') || url.hostname.includes('open-meteo.com')) return;

  // Google Fonts: cache first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // My own app files: network first, fall back to the cache when offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
    );
  }
});
