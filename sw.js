// Keeps every file of the counter on the device so it opens without a network.
// Bump VERSION whenever any file changes, so the iPad picks up the new copy.
const VERSION = "v2";
const CACHE = "bunkasai-counter-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "fonts/fonts.css",
  "fonts/DelaGothicOne.woff2",
  "fonts/ZenKakuGothicNew-500.woff2",
  "fonts/ZenKakuGothicNew-700.woff2",
  "fonts/ZenKakuGothicNew-900.woff2",
  "vendor/confetti-4.4.0.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Offline first: answer from the saved copy, and only go to the network for anything not saved
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (event.request.mode === "navigate") {
        return caches.match("index.html").then((page) => page || fetch(event.request));
      }
      return fetch(event.request);
    })
  );
});
