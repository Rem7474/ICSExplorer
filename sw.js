// Service Worker - Cache d'accès hors ligne
const CACHE_NAME = 'edt-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/favicon.svg'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch(() => {
        // Ignorer les erreurs de cache (fichiers distants)
      })
  );
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de récupération : cache d'abord, puis réseau
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retourner le cache s'il existe
        if (response) {
          return response;
        }
        // Sinon, récupérer du réseau
        return fetch(event.request)
          .then((response) => {
            // Ne pas cacher les réponses non-valides
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Cloner la réponse
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch(() => {
                // Ignorer les erreurs de cache
              });
            return response;
          })
          .catch(() => {
            // Retourner une page hors ligne si nécessaire
            return new Response('Mode hors ligne', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});
