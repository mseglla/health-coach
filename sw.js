const CACHE = 'health-coach-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/tokens.css', './css/base.css', './css/components.css', './css/screens.css',
  './js/app.js', './js/state.js', './js/storage.js', './js/calculations.js', './js/coach.js', './js/charts.js', './js/ui.js'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(response => response || fetch(event.request))));
