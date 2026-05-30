// Kivora Service Worker — offline-first caching
const CACHE_NAME = 'kivora-v3'
const STATIC_ASSETS = [
  '/',
  '/home',
  '/chat',
  '/research',
  '/devtools',
  '/study',
  '/opportunities',
  '/explore',
  '/tools',
  '/3d',
  '/dashboard',
  '/blog',
  '/favicon.svg',
  '/offline.html',
]

// Install: cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET and API calls
  if (request.method !== 'GET' || request.url.includes('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
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
