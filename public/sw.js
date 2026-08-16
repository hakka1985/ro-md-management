// Minimal PWA service worker: network-first with a cache fallback, so the
// app can still open (from whatever was last successfully loaded) when
// there's no connection. No precache list — Vite's build output uses
// content-hashed filenames that change every build, so a static list would
// go stale; caching whatever actually gets fetched avoids that entirely.
const CACHE_NAME = "ro-md-management-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          // Not the exact URL, but the app's own start page — cached the
          // first time it loaded. self.registration.scope already accounts
          // for whatever subpath this app is deployed under.
          const fallback = await cache.match(self.registration.scope);
          if (fallback) return fallback;
        }
        throw new Error("offline and not cached");
      }
    }),
  );
});
