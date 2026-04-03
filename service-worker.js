const CACHE_NAME = 'homicidios-uy-v94'; // INCREMENTA ESTE NÚMERO CADA VEZ QUE ACTUALICES LA WEB
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './location-picker.js',
    './mobile-gestures.js',
    './firebase-logic-v2.js',
    './donation-animations.css',
    './mobile-feed.css',
    './logo_final.jpg',
    './montevideo_barrios.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/topojson@3',
    'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap'
];

// Install Event - Cache Files
self.addEventListener('install', (event) => {
    self.skipWaiting(); // FORZAR ACTIVACIÓN INMEDIATA
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Escuchar mensajes de la página
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy: Network First for index.html
    // DO NOT CACHE .json data files anymore to prevent stale stats
    if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // For data JSONs, Network Only (to avoid any cache trickery)
    if (url.pathname.endsWith('.json')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // For other assets (CSS, JS, Images), Cache First fall back to Network
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    self.clients.claim(); // TOMAR CONTROL DE TODAS LAS PÁGINAS INMEDIATAMENTE
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Borrando caché vieja:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});
