const CACHE_NAME = "tiffyai-cache-v1";

// Only cache these
const urlsToCache = [
  "/",
  "/index.html",
  "/brainstorm.txt",
  "/knowledge.json"
];

// Install: pre-cache essential files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for fresh updates
self.addEventListener("fetch", (event) => {
  const requestURL = new URL(event.request.url);

  if (
    requestURL.pathname === "/" ||
    requestURL.pathname.endsWith("index.html") ||
    requestURL.pathname.endsWith("brainstorm.txt") ||
    requestURL.pathname.endsWith("knowledge.json")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with latest response
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => caches.match(event.request)) // fallback if offline
    );
  }
});
