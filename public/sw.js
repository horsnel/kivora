// Kivora Service Worker v12 — NO-OP
//
// Previous versions (v8–v9) used network-first caching that could:
//   1. Return undefined to event.respondWith() → TypeError crash
//   2. Cache stale HTML referencing old chunk hashes → hydration failure
//   3. Intercept cross-origin requests incorrectly
//
// This version does NOT intercept any requests. It only:
//   - Cleans up all old caches on activate
//   - Registers as a service worker so browsers auto-update from v9
//
// Static assets are already cached by the browser via Cache-Control headers
// set by Cloudflare Pages (immutable for /_next/static/). HTML pages get
// must-revalidate via public/_headers. No SW caching needed.

const CACHE_NAME = 'kivora-v12'

// Install: activate immediately, no pre-caching
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Activate: clean ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: DO NOT INTERCEPT — let the browser handle all requests natively.
// This eliminates the SW as a source of crashes entirely.
