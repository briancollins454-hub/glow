const CACHE_NAME = "glow-shell-v3";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
          `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glow offline</title><body style="margin:0;font-family:system-ui;background:#0b0910;color:#fff;display:grid;min-height:100vh;place-items:center;padding:24px"><main style="max-width:420px;text-align:center"><h1>You're offline</h1><p style="color:#d8cbd4">Glow needs a connection for live bookings and client data. Reconnect and try again.</p></main></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});
