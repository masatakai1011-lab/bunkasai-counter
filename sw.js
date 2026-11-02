// Keeps a copy of every file so the page still opens if the network drops for a moment.
// Network first: whenever the iPad is online it gets the newest files, so updates arrive by themselves.
// (The counts themselves live in Firebase, not here.)
const VERSION = "crepe-v4";
const CACHE = "bunkasai-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "register.html",
  "pass.html",
  "style.css",
  "app.js",
  "firebase-config.js",
  "manifest.webmanifest",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "fonts/fonts.css",
  "fonts/DelaGothicOne.woff2",
  "fonts/ZenKakuGothicNew-500.woff2",
  "fonts/ZenKakuGothicNew-700.woff2",
  "fonts/ZenKakuGothicNew-900.woff2",
  "vendor/confetti-4.4.0.min.js",
  "vendor/firebase-app-compat-10.12.2.js",
  "vendor/firebase-database-compat-10.12.2.js"
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only this site's own files; Firebase traffic goes straight to the network
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
  );
});
