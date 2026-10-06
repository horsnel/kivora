// Kivora Service Worker v13 — MINIMAL-RISK CACHING
//
// History: v8–v9 had caching bugs (undefined respondWith crashes, stale HTML
// referencing old chunk hashes after deploys) → v10–v12 went full no-op.
// v13 reintroduces caching with a strictly additive, provably-safe policy:
//
//   1. /_next/static/*        → cache-first. These URLs are content-hashed
//                               and served immutable (see public/_headers),
//                               so a cache hit can never be stale.
//   2. Navigations (HTML)     → network-first with NO HTML caching. If the
//                               network fails, serve /offline.html. Deploy
//                               freshness is never compromised — an open tab
//                               always gets fresh HTML when online, so the
//                               stale-chunk class of bugs cannot return.
//   3. Everything else        → NOT intercepted. API routes (including SSE
//                               streaming), RSC payload fetches, cross-origin
//                               requests all pass through untouched.
//
// Every respondWith() path resolves to a concrete Response — this worker can
// never crash by resolving undefined (the v8 failure mode).

const VERSION = 'kivora-v13'
const STATIC_CACHE = `${VERSION}-static`
const PRECACHE = ['/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      // Precache individually so one failure can't break install
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request

  // Only handle same-origin GETs; everything else passes through untouched.
  if (req.method !== 'GET') return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // NEVER touch API routes — SSE streaming (/api/chat etc.) must bypass the SW.
  if (url.pathname.startsWith('/api/')) return

  // NEVER touch Next.js RSC/prefetch traffic — intercepting it risks serving
  // stale client-router payloads after a deploy (transient React #300 class).
  if (
    req.headers.get('RSC') ||
    req.headers.get('Next-Router-Prefetch') ||
    req.headers.get('Next-Router-State-Tree')
  ) {
    return
  }

  // ── Navigations: network-first, offline fallback, NO HTML caching ──
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req)
        } catch {
          try {
            const offline = await caches.match('/offline.html')
            if (offline) return offline
          } catch {}
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        }
      })()
    )
    return
  }

  // ── Immutable hashed build assets: cache-first ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        try {
          const cached = await caches.match(req)
          if (cached) return cached
          const res = await fetch(req)
          if (res && res.ok) {
            try {
              const cache = await caches.open(STATIC_CACHE)
              await cache.put(req, res.clone())
              // Keep the runtime cache bounded — hashed assets accumulate per deploy
              const keys = await cache.keys()
              if (keys.length > 300) {
                for (const oldKey of keys.slice(0, keys.length - 300)) {
                  await cache.delete(oldKey)
                }
              }
            } catch {}
          }
          return res
        } catch {
          try {
            const cached = await caches.match(req)
            if (cached) return cached
          } catch {}
          return new Response('', { status: 504, headers: { 'Content-Type': 'text/plain' } })
        }
      })()
    )
    return
  }

  // Everything else (public/ files, avatar route, etc.) — browser HTTP cache
  // handles these natively via Cache-Control headers. No interception.
})
