self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Permet au navigateur de charger le site distant
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
