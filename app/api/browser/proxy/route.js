// ════════════════════════════════════════════════════════════════════
// GET|POST /api/browser/proxy — Kivora Browser fetch engine (v5.24.6)
//
// Server-side fetch + rewrite pipeline that lets the in-app browser
// render arbitrary public sites inside a SANDBOXED same-origin iframe:
//   - SSRF wall: only public http/https hosts pass validateTarget()
//   - HTML:      <base> pins relative assets to the source host, while
//                links / form actions / meta-refresh are re-routed
//                through this proxy so navigation stays inside Kivora
//   - Binary:    images / PDFs / fonts stream straight through
//   - Failures:  branded error page (HTTP 200) so the sandboxed iframe
//                shows a usable UI even when the target site is down;
//                &diag=1 returns machine-readable JSON instead (tests)
//
// No cookies, no credentials, no caching — every response is no-store.
// runtime=edge is MANDATORY for next-on-pages (v5.22 lesson).
// ════════════════════════════════════════════════════════════════════
import { validateTarget, rewriteHtml } from '@/lib/browser/core.mjs'

export const runtime = 'edge'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const HTML_CAP = 4 * 1024 * 1024 // 4 MB of HTML is far past any real page
const BINARY_CAP = 15 * 1024 * 1024
const FETCH_TIMEOUT = 15000

const proxyHref = (abs) => `/api/browser/proxy?url=${encodeURIComponent(abs)}`

function baseHeaders(extra) {
  return {
    'cache-control': 'no-store, max-age=0',
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
<a href="${safe ? '/browser' : '/browser'}" style="display:inline-block;padding:10px 22px;border-radius:12px;background:#FF3366;color:#fff;font-size:13px;font-weight:600;text-decoration:none">Back to Kivora Browser</a>
</div></body></html>`
  return new Response(html, {
    status,
    headers: baseHeaders({ 'content-type': 'text/html; charset=utf-8' }),
  })
}

async function handle(req) {
  const u = new URL(req.url)
  const diag = u.searchParams.get('diag') === '1'
  const desktop = u.searchParams.get('ua') === 'desktop'
  const targetRaw = u.searchParams.get('url') || ''

  // ── SSRF wall ──
  const v = validateTarget(targetRaw)
  if (!v.ok) {
    if (diag) return Response.json({ ok: false, reason: v.reason }, { status: 403, headers: { 'cache-control': 'no-store' } })
    return errorPage(targetRaw, 'The address was blocked by Kivora Browser (unsupported scheme or non-public host).', 200)
  }
  const target = v.url

  // ── Upstream fetch ──
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT)
  let res
  try {
    res = await fetch(target, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'user-agent': desktop ? DESKTOP_UA : MOBILE_UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,fr;q=0.8,sw;q=0.7',
        'sec-fetch-site': 'none',
        'upgrade-insecure-requests': '1',
        ...(req.method === 'POST' && req.headers.get('content-type')
          ? { 'content-type': req.headers.get('content-type') }
          : {}),
      },
      redirect: 'follow',
      signal: ac.signal,
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

  // ── HTML pipeline: cap, rewrite, re-serve from our origin ──
  const isHtml = ct.includes('text/html') || ct.includes('application/xhtml')
  if (isHtml) {
    const buf = await res.arrayBuffer()
    if (buf.byteLength > HTML_CAP) {
      return errorPage(target, 'The page is too large for the in-app browser (over 4 MB of markup).', 200)
    }
    const charsetMatch = /charset=([\w-]+)/i.exec(ct)
    let html
    try {
      html = new TextDecoder(charsetMatch ? charsetMatch[1] : 'utf-8').decode(buf)
    } catch {
      html = new TextDecoder('utf-8').decode(buf)
    }
    const rewritten = rewriteHtml(html, finalUrl, proxyHref)
    return new Response(rewritten, {
      status: res.status,
      headers: baseHeaders({ 'content-type': 'text/html; charset=utf-8' }),
    })
  }

  // ── Everything else passes through byte-for-byte (size-capped) ──
  const buf = await res.arrayBuffer()
  if (buf.byteLength > BINARY_CAP) {
    if (diag) return Response.json({ ok: false, reason: 'too_large' }, { status: 502, headers: { 'cache-control': 'no-store' } })
    return errorPage(target, 'The file is too large to show in the in-app browser (over 15 MB).', 200)
  }
  const passthroughCt = ct || 'application/octet-stream'
  return new Response(buf, {
    status: res.status,
    headers: baseHeaders({
      'content-type': passthroughCt,
      ...(ct.includes('pdf') ? { 'content-disposition': 'inline' } : {}),
    }),
  })
}

export async function GET(req) {
  return handle(req)
}

export async function POST(req) {
  return handle(req)
}
