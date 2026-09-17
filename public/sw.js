// Service worker for the timing app. A marshal can reload the app while offline and keep recording:
// the recorded times themselves live in IndexedDB, this only keeps the app shell available.
const SHELL_CACHE = "todorovnet-shell-v3";

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

// The app is often reached by an in-app navigation (after signing in), which the worker never sees as a
// page load. So the page sends its own URL and the scripts it already loaded, and they are cached here.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache-shell" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        data.urls
          .filter((url) => new URL(url, self.location.origin).origin === self.location.origin)
          .map((url) =>
            fetch(url, { credentials: "same-origin" })
              .then((response) => (response.ok ? cache.put(url, response) : undefined))
              .catch(() => undefined),
          ),
      ),
    ),
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
    const cached = async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(url.pathname)) ?? (await cache.match("/bg/t")) ?? (await cache.match("/en/t"));
    };
    const network = fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(url.pathname, copy));
      }
      return response;
    });
    // One bar of signal can keep a request open for a minute. After 3 s the saved app opens instead,
    // while the network copy still refreshes the cache in the background.
    const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(cached);
    event.respondWith(
      Promise.race([network.catch(() => null), slow.then((response) => response ?? network)])
        .catch(() => null)
        .then((response) => response ?? cached())
        .then((response) => response ?? Response.error()),
    );
  }
});
