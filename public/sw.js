/* X-VAULT Service Worker — PWA shell cache + Web Push notifications */

const CACHE = "xv-shell-v1";
const PRECACHE = ["/", "/offline.html"];

// ── Install: pre-cache shell ───────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(PRECACHE).catch(() => {
        /* offline.html may not exist in dev — ignore */
      }),
    ),
  );
  self.skipWaiting();
});

// ── Activate: claim clients + prune stale caches ──────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: network-first for API/HTML, cache-first for static assets ───────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Network-first for HTML pages and API routes
  if (url.pathname.startsWith("/api/") || request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(request)
        .then((r) => {
          if (request.headers.get("accept")?.includes("text/html") && r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return r;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match("/offline.html"))),
    );
    return;
  }

  // Cache-first for static assets (_next/static, icons, fonts)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|woff2?)$/)
  ) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((r) => {
            if (r.ok) {
              const clone = r.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return r;
          }),
      ),
    );
  }
});

// ── Push: show notification ────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = {
    title: "X-VAULT",
    body: "You have a new notification.",
    url: "/notifications",
    icon: "/icon-192.png",
  };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {
    /* ignore parse errors */
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon ?? "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "xv-default",
      data: { url: data.url ?? "/" },
      vibrate: [100, 50, 100],
    }),
  );
});

// ── Notification click: focus or open tab ─────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const targetUrl = e.notification.data?.url ?? "/";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const match = clients.find((c) => {
        try {
          return new URL(c.url).pathname === new URL(targetUrl, self.location.origin).pathname;
        } catch {
          return false;
        }
      });
      if (match) return match.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});

// ── Push subscription change ──────────────────────────────────────────────
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: e.oldSubscription?.options?.applicationServerKey,
      })
      .then((sub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
              auth: arrayBufferToBase64(sub.getKey("auth")),
            },
          }),
        }),
      )
      .catch(() => {}),
  );
});

function arrayBufferToBase64(buf) {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
