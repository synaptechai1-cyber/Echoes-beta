// Echoes service worker — minimal by design.
// Its only job right now is to satisfy the browser's requirement that a
// service worker be registered before it will offer a proper "Install app"
// prompt. It does not cache anything yet, so the app always loads fresh —
// safe for a fast-moving test phase. Offline support can be layered in
// later once the app is stable.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Pass-through fetch handler — required for "installability" criteria in
// Chrome/Edge/Android even when no caching strategy is implemented yet.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
