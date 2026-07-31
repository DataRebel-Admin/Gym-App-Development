/* GymRebel service worker — web-push ontvangst + PWA offline-shell.
 *
 * Push: toont een notificatie bij een push-event en opent de bijbehorende
 * pagina bij een klik.
 * PWA: precachet een offline-fallback + kern-icoon; navigaties zijn
 * network-first (altijd verse HTML online, offline → /offline.html), gehashte
 * statische assets zijn cache-first met achtergrond-refresh. Bewust géén
 * caching van API-/auth-verkeer of niet-GET-requests.
 *
 * De fallback is een statisch bestand (public/offline.html), GEEN Next-route.
 * Een App Router-pagina precachet alleen haar HTML; haar JS-chunks dragen een
 * build-hash en staan dus niet in PRECACHE. Offline faalden die chunks, waarna
 * de Next-runtime herlaadde, opnieuw de fallback kreeg en opnieuw faalde: het
 * zichtbare geflikker. Statische HTML heeft geen runtime en blijft staan.
 *
 * CACHE ophogen bij elke wijziging aan PRECACHE of aan offline.html, anders
 * houden bestaande clients hun oude kopie (activate wist alleen ándere versies). */

const CACHE = "gymrebel-v4";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigaties: network-first met offline-fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
    return;
  }

  // Gehashte statische assets: cache-first, ververst op de achtergrond.
  const url = new URL(request.url);
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          // Zonder cache én zonder netwerk moet hier een échte Response uit:
          // `respondWith` van een undefined gooit een TypeError in de console.
          .catch(() => cached || Response.error());
        return cached || network;
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "GymRebel", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "GymRebel";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    badge: "/favicon.ico",
    icon: "/favicon.ico",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
