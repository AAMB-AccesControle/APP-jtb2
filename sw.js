const CACHE_NAME = 'aamb-cache-v1';

self.addEventListener('install', (event) => {
  console.log('SW: Installé');
});

self.addEventListener('fetch', (event) => {
  // Nécessaire pour que le navigateur considère l'app comme PWA
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});