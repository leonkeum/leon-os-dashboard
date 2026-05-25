const CACHE_NAME = 'leon-os-v3'; // bump version to bust old cache
const STATIC = ['./dashboard.html', './dashboard.css', './dashboard.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for all our own files so updates always land immediately.
  // Falls back to cache only when offline.
  const url = event.request.url;
  const isOwn = STATIC.some(s => url.endsWith(s.replace('./', '')));
  if (isOwn) {
    event.respondWith(
      fetch(event.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return resp;
      }).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
