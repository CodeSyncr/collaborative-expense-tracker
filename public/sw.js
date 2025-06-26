self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        return (
          response ||
          fetch(event.request).then((fetchResponse) => {
            return caches.open("dynamic-v1").then((cache) => {
              cache.put(event.request, fetchResponse.clone());
              return fetchResponse;
            });
          })
        );
      })
      .catch(() => {
        // Optionally, return offline fallback here
        if (event.request.destination === "document") {
          return caches.match("/_offline.html");
        }
      })
  );
});
