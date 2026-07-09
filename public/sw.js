// Chrome only offers a real "Install app" (vs. a plain bookmark) when a
// service worker with a fetch handler is registered. This app has no
// meaningful offline story (it's a live family dashboard with session
// cookies), so this deliberately does no caching — it just satisfies the
// installability requirement and passes every request straight to the
// network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
