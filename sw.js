// Ce code permet à l'application de fonctionner même hors-ligne
self.addEventListener('install', (e) => {
  console.log('Service Worker installé');
});

self.addEventListener('fetch', (e) => {
  // Nécessaire pour valider la PWA
  e.respondWith(fetch(e.request));
});