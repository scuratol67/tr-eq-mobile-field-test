const CACHE = "tr-eq-field-v37-main-line-endo-recovery";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add("./manifest.webmanifest")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isPhoto = event.request.destination === "image";

  if (event.request.mode === "navigate") {
    // Always ask the network for the current app shell first. The former
    // cache-first rule could copy an old app shell into every new cache and
    // leave installed phones permanently stuck on an obsolete build.
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put("./", copy));
      }
      return response;
    }).catch(() => caches.match("./")));
    return;
  }

  if (sameOrigin || isPhoto) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    })));
  }
});
