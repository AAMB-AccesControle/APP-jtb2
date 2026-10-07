const CACHE_NAME = 'aamb-v3';
const STATIC_ASSETS = [
    './', './app.html', './index.html', './manifest.json',
    './js/commun.js', './logo-aamb.png', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Ne pas intercepter les requêtes non-GET
    if (event.request.method !== 'GET') return;
    
    // API Google Apps Script : toujours network-first
    if (event.request.url.includes('script.google.com')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache aussi la réponse API pour hors ligne
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // Ressources statiques : cache-first
    event.respondWith(
        caches.match(event.request).then(r => r || fetch(event.request))
    );
});
