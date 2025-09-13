const CACHE_NAME = "tiffyai-cache-v1";

// Files to always keep fresh
const urlsToCache = [
  "/index.html",
  "/brainstorm.txt",
  "/knowledge.json"
];

// Install: pre-cache essential files with version busting
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        urlsToCache.map((url) => {
          const bustUrl = url + "?v=" + Date.now(); // 👈 cache-busting
          return fetch(bustUrl).then((response) => {
            if (response.ok) {
              return cache.put(url, response); // store under original name
            }
          }).catch(() => {
            console.warn("Failed to fetch on install:", url);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache-busting
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    url.pathname.endsWith("index.html") ||
    url.pathname.endsWith("brainstorm.txt") ||
    url.pathname.endsWith("knowledge.json") ||
    url.pathname === "/"
  ) {
    event.respondWith(
      fetch(url.pathname + "?v=" + Date.now()) // 👈 always try fresh
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(url.pathname, clone);
          });
          return response;
        })
        .catch(() => caches.match(url.pathname)) // fallback offline
    );
  }
});
