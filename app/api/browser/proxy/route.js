// ════════════════════════════════════════════════════════════════════
// GET|POST /api/browser/proxy — Kivora Browser fetch engine (v5.25)
//
// Server-side fetch + rewrite pipeline that lets the in-app browser
// render arbitrary public sites inside a SANDBOXED same-origin iframe:
//   - SSRF wall: only public http/https hosts pass validateTarget()
//   - HTML:      STREAMED (never buffered end-to-end): the head phase
//                injects <base> + the DevTools agent, body chunks are
//                rewritten incrementally — first paint happens as soon
//                as the upstream site starts responding
//   - Binary:    images / PDFs / fonts stream straight through
//   - Speed:     upstream fetches set cf.cacheEverything, so repeat
//                visits are served from Cloudflare's edge cache BEFORE
//                the isolate even runs; rewritten HTML gets a short
//                browser-side cache window (back/forward is instant,
//                reload still busts via &kb=)
//   - Failures:  branded error page (HTTP 200) so the sandboxed iframe
//                shows a usable UI even when the target site is down;
//                &diag=1 returns machine-readable JSON instead (tests)
//
// v5.25 NOTE on runtime context: this route deliberately does NOT use
// getRequestContext()/caches.default/waitUntil. The installed
// @cloudflare/next-on-pages build exposes NO runtime exports from the
// bare specifier (verified in node_modules) — a static import yields
// `undefined` and every request 500s. Edge caching therefore rides on
// the fetch `cf` object, which is handled by the runtime BELOW the
// isolate and cannot throw here. Same lesson as the v5.22 edge-runtime
// one: no exotic APIs on the hot path.
//
// No cookies, no credentials. runtime=edge is MANDATORY for
// next-on-pages (v5.22 lesson).
// ════════════════════════════════════════════════════════════════════
import { validateTarget, createStreamingRewriter, rewriteHtml } from '@/lib/browser/core.mjs'
import { AGENT_TAG } from '@/lib/browser/devtools-agent.mjs'

export const runtime = 'edge'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const FETCH_TIMEOUT = 15000
const HTML_EDGE_TTL = 60 // seconds at Cloudflare's edge (fresh enough for news, fast enough to feel instant)
const ASSET_EDGE_TTL = 6 * 3600 // binaries through the proxy are stable per-URL
const HTML_BROWSER_TTL = 120 // browser HTTP cache for rewritten HTML (reload busts via &kb=)

function baseHeaders(extra) {
  return {
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'no-referrer',
    'x-kivora-proxy': '1',
    ...extra,
  }
}

function errorPage(target, reason, status) {
  const safe = String(target || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kivora Browser</title></head>
<body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
<div style="max-width:420px;text-align:center">
<div style="width:52px;height:52px;border-radius:16px;background:#141414;border:1px solid #262626;display:flex;align-items:center;justify-content:center;margin:0 auto 18px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3366" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></div>
<h1 style="font-size:18px;font-weight:600;margin:0 0 8px">This page couldn't be loaded</h1>
<p style="font-size:13px;line-height:1.6;color:#737373;margin:0 0 6px;word-break:break-all">${safe}</p>
<p style="font-size:12px;color:#525252;margin:0 0 22px">${reason}</p>
<a href="/browser" style="display:inline-block;padding:10px 22px;border-radius:12px;background:#FF3366;color:#fff;font-size:13px;font-weight:600;text-decoration:none">Back to Kivora Browser</a>
</div></body></html>`
  return new Response(html, {
    status,
    headers: baseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8' }),
  })
}

function charsetOf(ct) {
  const m = /charset=([\w-]+)/i.exec(ct || '')
  return m ? m[1] : 'utf-8'
}

async function handle(req) {
  const t0 = Date.now()
  const u = new URL(req.url)
  const diag = u.searchParams.get('diag') === '1'
  const desktop = u.searchParams.get('ua') === 'desktop'
  const targetRaw = u.searchParams.get('url') || ''
  const isGet = req.method === 'GET'

  // ── SSRF wall ──
  const v = validateTarget(targetRaw)
  if (!v.ok) {
    if (diag) return Response.json({ ok: false, reason: v.reason }, { status: 403, headers: { 'cache-control': 'no-store' } })
    return errorPage(targetRaw, 'The address was blocked by Kivora Browser (unsupported scheme or non-public host).', 200)
  }
  const target = v.url

  // ── Upstream fetch (cf.cacheEverything = edge cache below the isolate) ──
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT)
  let res
  try {
    res = await fetch(target, {
      method: isGet ? 'GET' : 'POST',
      headers: {
        'user-agent': desktop ? DESKTOP_UA : MOBILE_UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,fr;q=0.8,sw;q=0.7',
        'sec-fetch-site': 'none',
        'upgrade-insecure-requests': '1',
        ...(req.headers.get('range') ? { range: req.headers.get('range') } : {}),
        ...(req.method === 'POST' && req.headers.get('content-type')
          ? { 'content-type': req.headers.get('content-type') }
          : {}),
      },
      redirect: 'follow',
      signal: ac.signal,
      // Workers-only fetch option — silently ignored off-Cloudflare.
      // Cacheable GETs get served from the nearest colo on repeat visits.
      cf: isGet ? { cacheEverything: true, cacheTtl: HTML_EDGE_TTL } : undefined,
      body: req.method === 'POST' ? await req.arrayBuffer() : undefined,
    })
  } catch (e) {
    clearTimeout(timer)
    const reason = ac.signal.aborted ? 'The site took too long to respond (15s timeout).' : 'The site refused the connection or does not exist.'
    if (diag) return Response.json({ ok: false, reason: ac.signal.aborted ? 'timeout' : 'network_error', detail: String(e?.message || '').slice(0, 160) }, { status: 502, headers: { 'cache-control': 'no-store' } })
    return errorPage(target, reason, 200)
  }
  clearTimeout(timer)

  const finalUrl = res.url || target
  const ct = (res.headers.get('content-type') || '').toLowerCase()

  // ── HTML pipeline: STREAM + rewrite on the fly ──
  const isHtml = ct.includes('text/html') || ct.includes('application/xhtml')
  if (isHtml && res.body) {
    const enc = new TextEncoder()
    const dec = new TextDecoder(charsetOf(ct))
    const rewriter = createStreamingRewriter(finalUrl, (abs) => `/api/browser/proxy?url=${encodeURIComponent(abs)}`, AGENT_TAG)

    const stream = new TransformStream({
      transform(chunk, ctrl) {
        // bytes → string (streaming decoder keeps multi-byte chars intact
        // across chunk borders) → rewrite → bytes
        const out = rewriter.push(dec.decode(chunk, { stream: true }))
        if (out) ctrl.enqueue(enc.encode(out))
      },
      flush(ctrl) {
        const out = rewriter.end()
        if (out) ctrl.enqueue(enc.encode(out))
      },
    })

    res.body.pipeThrough(stream)
    return new Response(stream.readable, {
      status: res.status,
      headers: baseHeaders({
        'content-type': 'text/html; charset=utf-8',
        // browser-side cache: back/forward and same-URL revisits are
        // instant; explicit reloads bump &kb= and bypass this cache
        ...(isGet ? { 'cache-control': `private, max-age=${HTML_BROWSER_TTL}` } : { 'cache-control': 'no-store' }),
      }),
    })
  }

  // ── HTML but no body (204/HEAD-style) — degenerate passthrough ──
  if (isHtml) {
    return new Response(rewriteHtml('', finalUrl, (abs) => `/api/browser/proxy?url=${encodeURIComponent(abs)}`, AGENT_TAG), {
      status: res.status,
      headers: baseHeaders({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }),
    })
  }

  // ── Everything else streams through byte-for-byte ──
  if (diag) {
    return Response.json(
      { ok: res.ok, status: res.status, finalUrl, contentType: ct, ms: Date.now() - t0, streamed: true },
      { headers: { 'cache-control': 'no-store' } }
    )
  }
  return new Response(res.body, {
    status: res.status,
    headers: baseHeaders({
      'content-type': ct || 'application/octet-stream',
      ...(ct.includes('pdf') ? { 'content-disposition': 'inline' } : {}),
      ...(isGet ? { 'cache-control': `private, max-age=${ASSET_EDGE_TTL}` } : { 'cache-control': 'no-store' }),
    }),
  })
}

export async function GET(req) {
  return handle(req)
}

export async function POST(req) {
  return handle(req)
}
