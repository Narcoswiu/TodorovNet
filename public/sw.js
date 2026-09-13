// Service worker for the timing app. A marshal can reload /t while offline and keep recording:
// the recorded times themselves live in IndexedDB, this only keeps the app shell available.
const SHELL_CACHE = "todorovnet-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("todorovnet-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only same-origin assets and pages; Supabase API calls always go to the network.
  if (url.origin !== self.location.origin) return;

  // Build assets are content-hashed: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Timing app pages (/bg/t, /en/t, and /t from the installed app icon): network first,
  // fall back to the last copy when offline.
  const isTimingPage = /^\/((bg|en)\/)?t(\/|$)/.test(url.pathname);
  if (request.mode === "navigate" && isTimingPage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request)) ??
            (await cache.match("/bg/t")) ??
            (await cache.match("/en/t")) ??
            Response.error()
          );
        }),
    );
  }
});
