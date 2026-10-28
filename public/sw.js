// Kivora Service Worker v18 — BROWSER COOKIE JAR PIPE + MINIMAL-RISK CACHING
//
// History: v8–v9 had caching bugs (undefined respondWith crashes, stale HTML
// referencing old chunk hashes after deploys) → v10–v12 went full no-op.
// v13 reintroduced caching with a strictly additive, provably-safe policy.
// v14 was a policy-identical version bump whose ONLY job is to guarantee
// every client swaps onto the current worker: the install → skipWaiting →
// activate → clients.claim → purge-foreign-caches chain forcibly retires
// any zombie v8/v9 worker a device may still be running (those served
// stale HTML that pinned users to dead builds across refreshes).
// v15 (v5.24.4) keeps the v14 caching policy byte-identical and upgrades
// the push handler: full-options display → minimal-options retry → and a
// KIVORA_PUSH_RESULT postMessage to every open page, so the profile test
// button can tell "never reached the device" apart from "reached but the
// OS blocked the display" without any guesswork.
// v16 (v5.24.5) adds server-side receipts: every display attempt is also
// POSTed to /api/push/receipt (keyed by an unguessable endpoint suffix),
// so the verdict survives page closes and phone reboots — and a message
// ping-pong lets the page verify WHICH worker version is actually
// controlling it (zombie-worker detection).
// v17 (v5.24.6) is a policy-identical version bump riding the Kivora
// Browser release — its only job is to move every device onto the
// current worker so the profile version readout stays trustworthy.
// v18 (v5.30) — KIVORA BROWSER SIGN-IN: intercepts /api/browser/proxy
// requests (GET navigations AND POST form submissions — the only API
// route this worker ever touches) and pipes a client-held cookie jar:
//   load jar → attach as `x-kv-jar` → proxy forwards cookies upstream →
//   proxy captures Set-Cookie at every redirect hop → response carries
//   the updated jar in `x-kv-cookies` → stored back (Cache API, keyed by
//   the `ks` browser-session id). The jar NEVER touches page JS: the
//   response header is not CORS-safelisted, so the sandboxed iframe
//   (opaque origin) cannot read it — only this worker can.
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

const VERSION = 'kivora-v18'
const STATIC_CACHE = `${VERSION}-static`
const JAR_CACHE = `${VERSION}-jar`
const PRECACHE = ['/offline.html']

// ── v5.30 cookie jar storage (Cache API as a tiny KV) ──
// Keyed by the sanitized browser-session id from the proxy URL's `ks`
// param. Values are JSON jars: { [scope]: [{ n, v, exp? }] }. A synthetic
// https URL is the cache key — it is never fetched.
const jarUrlFor = (sid) => `https://kv-jar.kivora.internal/${sid}`

async function jarLoad(sid) {
  try {
    const cache = await caches.open(JAR_CACHE)
    const hit = await cache.match(jarUrlFor(sid))
    return hit ? await hit.json() : {}
  } catch {
    return {}
  }
}

async function jarSave(sid, jar) {
  try {
    const cache = await caches.open(JAR_CACHE)
    await cache.put(jarUrlFor(sid), new Response(JSON.stringify(jar || {}), { headers: { 'content-type': 'application/json' } }))
  } catch {}
}

// Mirror of core.mjs cookiesForHost (the SW is a classic script — no
// module imports). host === scope, or a subdomain of it.
function kvHostMatches(host, scope) {
  return host === scope || host.endsWith('.' + scope)
}

function kvCookiesForHost(jar, host) {
  try {
    const h = String(host || '').toLowerCase()
    if (!h) return ''
    const now = Date.now()
    const seen = new Set()
    const parts = []
    for (const scope of Object.keys(jar || {})) {
      if (!kvHostMatches(h, scope)) continue
      for (const c of jar[scope] || []) {
        if (!c || !c.n) continue
        if (c.exp && Date.parse(c.exp) <= now) continue
        if (seen.has(c.n)) continue
        seen.add(c.n)
        parts.push(`${c.n}=${c.v}`)
      }
    }
    return parts.join('; ').slice(0, 6144)
  } catch {
    return ''
  }
}

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
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== JAR_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // ── v5.30 — Kivora Browser proxy: the ONLY API route this worker
  // touches, because it is the one route whose behavior depends on
  // client-held session state (the cookie jar). GET navigations and POST
  // form submissions both flow through here.
  if (url.pathname === '/api/browser/proxy') {
    event.respondWith(
      (async () => {
        try {
          const sid = (url.searchParams.get('ks') || '').replace(/[^\w-]/g, '').slice(0, 64)
          let jar = {}
          if (sid) jar = await jarLoad(sid)
          let cookieHost = ''
          try {
            cookieHost = new URL(url.searchParams.get('url') || '').hostname.toLowerCase()
          } catch {}
          const cookieStr = sid ? kvCookiesForHost(jar, cookieHost) : ''
          const headers = new Headers(req.headers)
          headers.set('x-kv-sw', '1') // the proxy ignores jars without this
          if (cookieStr) headers.set('x-kv-jar', JSON.stringify(jar))
          const res = await fetch(req, { headers })
          // Persist the updated jar. The response header is deliberately
          // NOT CORS-safelisted → invisible to the sandboxed iframe's JS.
          if (sid) {
            const updated = res.headers.get('x-kv-cookies')
            if (updated) {
              try {
                const parsed = JSON.parse(updated)
                if (parsed && typeof parsed === 'object') await jarSave(sid, parsed)
              } catch {}
            }
          }
          return res
        } catch {
          try {
            return await fetch(event.request)
          } catch (e2) {
            return new Response('Proxy unreachable', { status: 504, headers: { 'Content-Type': 'text/plain' } })
          }
        }
      })()
    )
    return
  }

  // Only handle same-origin GETs; everything else passes through untouched.
  if (req.method !== 'GET') return

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

// ── v5.22 Web Push · v5.24.4 device-receipt handshake ───────────────
// "Your reply finished generating while you were offline" — the chat route
// sends this when a background generation completes after a disconnect.
// Display strategy: full options first; if the platform rejects any option
// (icon/badge/tag quirks), retry with a minimal title+body display — a bad
// option must never cost the notification. The outcome is always posted to
// every open page so the profile test can produce a device-side verdict:
//   receipt displayed=true   → Chrome DID show it (shade may be collapsed)
//   receipt displayed=false  → reached the device, display failed (error)
//   no receipt within 15s    → push never reached the SW (delivery layer)
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { try { data = { body: event.data ? event.data.text() : '' } } catch {} }
  const title = String(data.title || 'Kivora').slice(0, 120)
  const body = String(data.body || '').slice(0, 300)
  const url = /^\/[a-z]/.test(String(data.url)) ? data.url : '/chat'
  event.waitUntil(
    (async () => {
      let displayed = false
      let error = null
      try {
        await self.registration.showNotification(title, {
          body,
          tag: String(data.tag || 'kivora-chat').slice(0, 60),
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { url },
        })
        displayed = true
      } catch (e1) {
        error = String((e1 && e1.message) || e1).slice(0, 160)
        try {
          await self.registration.showNotification(title, { body: body || title })
          displayed = true
          error = null
        } catch (e2) {
          error = String((e2 && e2.message) || e2).slice(0, 160)
        }
      }
      try {
        const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const c of cs) {
          try { c.postMessage({ type: 'KIVORA_PUSH_RESULT', displayed, error, tag: String(data.tag || 'kivora-chat'), at: Date.now() }) } catch {}
        }
      } catch {}
      // Server-side receipt (v5.24.5): survives page closes. Keyed by the
      // subscription endpoint's unguessable 24-char suffix; the route only
      // accepts tails that match an existing row.
      try {
        let tail = ''
        try {
          const sub = await self.registration.pushManager.getSubscription()
          if (sub && sub.endpoint) tail = sub.endpoint.slice(-24)
        } catch {}
        await fetch('/api/push/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tail, displayed, error, sw: VERSION, at: Date.now() }),
        })
      } catch {}
    })()
  )
})

// v5.24.5 — zombie-worker detection: the page pings, we answer with the
// exact version string currently controlling it.
self.addEventListener('message', (event) => {
  try {
    if (event.data && event.data.type === 'KIVORA_PING' && event.source) {
      event.source.postMessage({ type: 'KIVORA_SW_VERSION', version: VERSION })
    }
  } catch {}
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/chat'
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientList) {
        try {
          const u = new URL(client.url)
          if (u.origin === self.location.origin && 'focus' in client) {
            await client.focus()
            if ('navigate' in client) { try { await client.navigate(target) } catch {} }
            return
          }
        } catch {}
      }
      await self.clients.openWindow(target)
    })()
  )
})
