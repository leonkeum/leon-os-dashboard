const CACHE_NAME = 'leon-os-v13'; // bumped: cache-bust static assets with ?v= query strings
const STATIC = [
  './dashboard.html',
  './dashboard.css?v=13',
  './js/shared-init.js?v=13',
  './js/gamification.js?v=13',
  './js/time-os.js?v=13',
  './js/skills-school.js?v=13',
  './js/life-os.js?v=13',
  './js/habits.js?v=13',
  './js/movement.js?v=13',
  './js/nutrition.js?v=13',
  './js/today-dashboard.js?v=13',
  './js/money.js?v=13',
  './js/chicos.js?v=13',
  './js/gist-sync.js?v=13',
  './js/weekly-review.js?v=13',
  './js/insights.js?v=13',
  './js/notifications.js?v=13',
];

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

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) { c.focus(); return; } }
      clients.openWindow('./dashboard.html');
    })
  );
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
