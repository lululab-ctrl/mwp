// Service worker: lets the app be installed on the home screen, keeps the app
// shell for quick starts, and shows push notifications.
const CACHE = 'twsp-shell-v1';
// Paths are relative to where the app is hosted (works at / or at /repo-name/).
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'fonts/gs-regular.woff2', 'fonts/gs-bold.woff2', 'fonts/ploni-bold.woff2'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Same-origin GETs only: pages network-first (fall back to the cached shell
// offline), built files and images cache-first. API calls and Supabase are
// never cached.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const rel = url.href.startsWith(self.registration.scope) ? url.href.slice(self.registration.scope.length) : null;
  if (e.request.method !== 'GET' || url.origin !== location.origin || rel === null || rel.startsWith('api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./')));
    return;
  }
  if (/^(assets|img|fonts)\//.test(rel)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })));
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'The Wild Side', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' }, dir: 'auto', lang: 'he',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
