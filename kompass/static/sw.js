// Minimaler Service Worker: nur damit die App auf dem Homescreen als App startet.
// Bewusst kein Cache, damit nie veraltete Zahlen angezeigt werden.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
