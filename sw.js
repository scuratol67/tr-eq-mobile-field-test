const APP_RELEASE = "95";
const SHELL_CACHE = `tr-eq-shell-v${APP_RELEASE}`;
const PHOTO_CACHE = "tr-eq-protected-photos-v1";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.add(new Request("./manifest.webmanifest", { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(name => {
      const replaceableShell = name.startsWith("tr-eq-shell-") || name.startsWith("tr-eq-field-");
      return replaceableShell && name !== SHELL_CACHE ? caches.delete(name) : Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, fallbackKey = request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) await cache.put(fallbackKey, response.clone());
    return response;
  } catch {
    const cached = await cache.match(fallbackKey);
    if (cached) return cached;
    throw new Error("TR Eq is offline and the app shell has not been cached yet.");
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isPhoto = event.request.destination === "image";

  // This maintenance route must always reach the server directly. It removes
  // only obsolete interface caches, so an installed phone can recover from a
  // stale app shell without touching IndexedDB, localStorage, or photo caches.
  if (sameOrigin && (url.pathname.endsWith("/api/refresh-phone") || url.pathname.endsWith("/phone-repair-92.html") || url.pathname.endsWith("/install-phone-93.html"))) return;

  if (event.request.mode === "navigate") {
    // Always ask the network for the current app shell first. The former
    // cache-first rule could copy an old app shell into every new cache and
    // leave installed phones permanently stuck on an obsolete build.
    event.respondWith(networkFirst(event.request, "./"));
    return;
  }

  if (isPhoto) {
    // Equipment photos remain available offline. Photo URLs are immutable once
    // protected, so cache-first is safe here and keeps field use responsive.
    event.respondWith((async () => {
      const cache = await caches.open(PHOTO_CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })());
    return;
  }

  if (sameOrigin) {
    // App JavaScript and styles must never remain pinned to an older release.
    // Ask the network first, while retaining a cache fallback for offline use.
    event.respondWith(networkFirst(event.request));
  }
});
