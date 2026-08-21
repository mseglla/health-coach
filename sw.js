const CACHE = 'health-coach-v28';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/icon.svg',
  './css/tokens.css', './css/base.css', './css/components.css', './css/screens.css',
  './js/app.js', './js/state.js', './js/storage.js',
  './js/indexeddb-adapter.js', './js/migrating-storage-adapter.js',
  './js/calculations.js',
  './js/daily-snapshot.js', './js/daily-insight.js',
  './js/history-summary.js',
  './js/coach.js', './js/charts.js', './js/ui.js',
  './js/weight-repository.js', './js/supabase-weight-repository.js',
  './js/supabase-daily-summary-repository.js',
  './js/supabase-health-metrics-repository.js',
  './js/supabase-activity-repository.js',
  './js/supabase-checkin-repository.js',
  './js/supabase-profile-repository.js',
  './js/supabase-goal-repository.js',
  './js/supabase-body-measurement-repository.js',
  './js/auth-ui.js', './js/auth-service.js',
  './js/supabase-client.js', './js/supabase-config.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => event.waitUntil(
  Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE)
        .map(key => caches.delete(key))
    ))
  ])
));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.protocol !== 'http:' && url.protocol !== 'https:' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
