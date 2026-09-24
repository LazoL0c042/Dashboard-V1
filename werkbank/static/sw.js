// Minimaler Service Worker: App-Hülle offline verfügbar, Daten immer frisch vom Server.
const CACHE = "werkbank-v1";
const SHELL = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => {
  if (new URL(e.request.url).pathname.startsWith("/api/")) return; // API nie cachen
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
