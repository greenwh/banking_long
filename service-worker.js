const CACHE_NAME = 'checkbook-cache-v7';
const urlsToCache = [ '/', '/index.html', '/style.css', '/script.js', '/database.js', '/data-io.js', '/manifest.json' ];

self.addEventListener('install', event => {
    event.waitUntil( caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)) );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    event.respondWith( caches.match(event.request).then(response => response || fetch(event.request)) );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheWhitelist.indexOf(cacheName) === -1) {
                    return caches.delete(cacheName);
                }
            })
        ))
    );
    return self.clients.claim();
});