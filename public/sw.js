// Echoes service worker — satisfies PWA installability requirements.
// Explicitly passes through ALL API calls without interference.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Never intercept API calls — let them go directly to the server
  if (url.pathname.startsWith('/api/')) {
    return // don't call event.respondWith — browser handles it natively
  }
  
  // Pass everything else through too for now
  event.respondWith(fetch(event.request))
})
