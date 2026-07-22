const CACHE = 'atles-v4-foundation-1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/tokens.css', './css/base.css', './css/components.css', './css/screens.css',
  './js/app.js', './js/state.js', './js/storage.js', './js/calculations.js', './js/coach.js', './js/charts.js', './js/ui.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => event.waitUntil(
  Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  ])
));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(response => response || caches.match('./index.html')))
  );
});