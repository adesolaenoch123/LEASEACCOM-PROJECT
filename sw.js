/* LeaseAccom PWA service worker
   Network-first for HTML so site updates appear in the installed app.
   Cache-first for static assets.
*/
const CACHE = "leaseaccom-pwa-v14";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return cache.addAll([
          "./",
          "./index.html",
          "./manifest.json",
          "./CSS/style.css",
          "./CSS/owner-messages.css",
          "./CSS/tenant-messages.css",
          "./CSS/skeletons.css",
          "./messages.html",
          "./owner-messages.html",
          "./IMAGES/leaseaccom-logo-full.png",
          "./IMAGES/leaseaccom-logo-icon.png",
          "./IMAGES/leaseaccom-messages-logo.png",
          "./IMAGES/leaseaccom-pwa-square-192.png",
          "./IMAGES/leaseaccom-pwa-square-512.png"
        ]);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Always try network first for HTML documents so updates show up
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match(new URL("./index.html", self.registration.scope).href);
        });
      })
    );
    return;
  }

  // For other assets: cache first, then network
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        if (res && res.status === 200 && req.method === "GET") {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            return cache.put(req, copy);
          }).catch(function (error) {
            console.warn("PWA asset cache update failed.", error);
          });
        }
        return res;
      });
    })
  );
});
