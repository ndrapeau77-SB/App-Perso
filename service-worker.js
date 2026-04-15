const CACHE_NAME = 'mon-app-perso-v1';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './service-worker.js',
  './citations.json',
  './image_pastille.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
