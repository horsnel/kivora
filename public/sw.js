// Kivora Service Worker — network-first caching with runtime cache.
//
// CHANGES (kivora-v9):
//   - Removed cache.addAll(STATIC_ASSETS) on install. Pre-caching full SSR'd
//     HTML for routes like /, /chat, /research was breaking hydration on
//     deploys: the cached HTML referenced old chunk hashes that 404'd after
//     a new deploy, causing React 19 to throw and the global-error boundary
//     to render ("Something went wrong / A critical error occurred").
//   - Now we only cache at runtime (network-first). The first request after a
//     deploy always hits the network and stores a fresh copy.
//   - Bumped CACHE_NAME to v9 so existing users drop v8 immediately.
//
const CACHE_NAME = 'kivora-v9'

// Install: activate immediately, no pre-caching
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Activate: clean old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first with cache fallback (runtime caching only)
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET and API calls
  if (request.method !== 'GET' || request.url.includes('/api/')) return

  // Skip Next.js internal chunk requests — let the browser cache them via
  // the immutable Cache-Control headers Next.js sets. This avoids stale
  // cached chunks surviving across deploys.
  if (request.url.includes('/_next/static/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses at runtime
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/offline.html'))
      )
  )
})
