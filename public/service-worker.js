// Bump this version whenever the caching rules change to invalidate old caches.
// Build output is content-hashed, so the asset list no longer lives here — files
// are cached as they are requested.
const CACHE = "weather-v6";
const PRECACHE = ["./", "./index.html", "./manifest.json", "./icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const cacheCopy = (request, response) => {
  const copy = response.clone();
  caches.open(CACHE).then(cache => cache.put(request, copy));
  return response;
};

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Weather, geocoding and air quality: network-first, falling back to the last
  // response so the app still shows something when offline.
  if (url.hostname.endsWith("open-meteo.com")) {
    event.respondWith(
      fetch(request)
        .then(response => cacheCopy(request, response))
        .catch(() => caches.match(request))
    );
    return;
  }

  // Map and radar tiles are large and always changing — leave them to the browser.
  if (url.origin !== self.location.origin) return;

  // Shared links carry a query string (?lat=…) but must still resolve to the page.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request, { ignoreSearch: true })
        .then(cached => cached || fetch(request).catch(() => caches.match("./index.html")))
    );
    return;
  }

  // App assets: cache-first, filling the cache as they are requested.
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(response => cacheCopy(request, response)))
  );
});
