const CACHE_NAME = 'leon-os-v1';
const ASSETS = [
  './dashboard.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Press+Start+2P&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([ASSETS[0]]))
  );
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
  // Cache-first for the dashboard, network-first for everything else
  if (event.request.url.includes('dashboard.html')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return resp;
      }))
    );
  } else {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
