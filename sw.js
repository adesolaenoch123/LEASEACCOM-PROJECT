/* LeaseAccom PWA service worker
   Network-first for HTML so site updates appear in the installed app.
   Cache-first for static assets.
*/
const CACHE = "leaseaccom-pwa-v2";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll([
        "./",
        "./index.html",
        "./CSS/style.css",
        "./JS/leaseaccom-mobile-nav.js"
      ]).catch(function () { /* ignore missing during install */ });
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
  // Always try network first for HTML documents so updates show up
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match("./index.html");
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
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      });
    })
  );
});
