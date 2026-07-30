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

// ---------------- Web push ----------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Glow", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Glow";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        // Reuse an open Glow tab/window when we can.
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(url);
          return undefined;
        }
      }
      return self.clients.openWindow(url);
    }),
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
