const CACHE_NAME = "mon-app-cache";
const APP_SHELL = [
  "./",
  "./index.html",
  "./notes.html",
  "./data.js",
  "./manifest.json",
  "./citations.json",
  "./image_pastille.png"
];

// Installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // On ignore tout ce qui n'est pas GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // HTML pages = on essaie toujours le réseau d'abord
  const isHtmlRequest =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Assets statiques = cache d'abord, puis réseau si absent
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return networkResponse;
      });
    })
  );
});
