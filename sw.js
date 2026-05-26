// Service Worker — caching strategies:
//   - Navigation (HTML)      : network-first, cache fallback   → always fresh online
//   - Static assets (JS/CSS) : stale-while-revalidate          → fast + auto-updates
//   - /output/ and .ics      : network-first, cache fallback   → fresh data, offline OK
//
// Install uses Promise.allSettled so one missing file doesn't kill the whole
// install — the old SW used cache.addAll() (atomic), so a single 404 left the
// PWA running with an empty cache → blank screen on next offline open.

const CACHE_NAME = 'edt-v12';
const PRECACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/favicon.svg',
  '/src/main.js',
  '/src/utils/dom.js',
  '/src/utils/dates.js',
  '/src/utils/colors.js',
  '/src/utils/collections.js',
  '/src/ics/parser.js',
  '/src/ics/api.js',
  '/src/ics/aggregator.js',
  '/src/ui/schedule.js',
  '/src/ui/modal.js',
  '/src/ui/toast.js',
  '/src/ui/controls.js',
  '/src/state/persistence.js',
  '/src/features/empty-rooms.js',
  '/src/features/week-stats.js',
  '/src/features/etag-watcher.js',
  '/src/features/favorites.js',
  '/src/features/notifications.js'
];

const offlineResponse = () =>
  new Response('Mode hors ligne', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });

const precacheResilient = async () => {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (!res || !res.ok) {
          throw new Error(`HTTP ${res && res.status}`);
        }
        await cache.put(url, res);
        return url;
      } catch (err) {
        console.warn('[SW] precache failed for', url, err);
        throw err;
      }
    })
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed) console.warn(`[SW] ${failed}/${PRECACHE.length} files failed to precache`);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheResilient();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// Allow client to ask the SW to activate immediately (used by main.js)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Click on a course notification → focus the existing PWA window, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        return client.focus();
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow('/');
    }
  })());
});

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineResponse();
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || (await networkFetch) || offlineResponse();
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const isIcs = url.pathname.endsWith('.ics');
  const isOutput = url.pathname.startsWith('/output/');
  const isNavigation = event.request.mode === 'navigate';

  // Dynamic data: always try network first
  if (isIcs || isOutput || isNavigation) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets: serve cache instantly, refresh in background
  event.respondWith(staleWhileRevalidate(event.request));
});
