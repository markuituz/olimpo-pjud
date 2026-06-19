const CACHE_NAME = 'olimpo-v3';

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Instalado');
});

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activado');
});

self.addEventListener('fetch', (event) => {

    event.respondWith(fetch(event.request));
});