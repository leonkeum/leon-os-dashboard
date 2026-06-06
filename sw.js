const CACHE_NAME = 'leon-os-v7'; // bumped: insights page, weekly review, notifications
const STATIC = [
  './dashboard.html',
  './dashboard.css',
  './js/shared-init.js',
  './js/gamification.js',
  './js/time-os.js',
  './js/skills-school.js',
  './js/life-os.js',
  './js/life-goals.js',
  './js/movement.js',
  './js/nutrition.js',
  './js/today-dashboard.js',
  './js/money.js',
  './js/side-projects.js',
  './js/chicos.js',
  './js/gist-sync.js',
  './js/weekly-review.js',
  './js/insights.js',
  './js/notifications.js',
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
