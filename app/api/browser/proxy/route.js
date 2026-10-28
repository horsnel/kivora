// ════════════════════════════════════════════════════════════════════
// GET|POST /api/browser/proxy — Kivora Browser fetch engine (v5.26)
//
// Server-side fetch + rewrite pipeline that lets the in-app browser
// render arbitrary public sites inside a SANDBOXED same-origin iframe:
//   - SSRF wall: only public http/https hosts pass validateTarget()
//   - HTML:      STREAMED (never buffered end-to-end): the head phase
//                injects <base> + the DevTools agent, body chunks are
//                rewritten incrementally — first paint happens as soon
//                as the upstream site starts responding
//   - Binary:    images / PDFs / fonts / media stream straight through
//                (Range + Content-Range forwarded so audio/video seek)
//   - Speed:     upstream fetches set cf.cacheEverything+cacheTtlByStatus,
//                so repeat visits are served from Cloudflare's edge cache
//                BEFORE the isolate even runs; rewritten HTML gets a
//                short browser-side cache window (back/forward is
//                instant, reload still busts via &kb=)
//   - Failures:  branded, LOCALE-AWARE error page (HTTP 200) so the
//                sandboxed iframe shows a usable UI when the target site
//                is down, requires a login, or refuses embedded browsers;
//                &diag=1 returns machine-readable JSON instead (tests)
//
// v5.30 — COOKIES (sign-in works now): the proxy accepts a client-held
//   cookie jar ("x-kv-jar", owned + stored by the service worker under a
//   per-browser-session id `ks`), forwards matching cookies upstream,
//   follows redirects MANUALLY (max 6 hops) so Set-Cookie is captured at
//   EVERY hop — the classic login flow (POST → 302 → /) sets its session
//   on the 302, which redirect:'follow' silently discards — and returns
//   the updated jar via "x-kv-cookies" (never exposed to the sandboxed
//   iframe's JS — the header is not CORS-safelisted). POST also gets an
//   Origin header (target's own origin) so CSRF checks pass. Edge cache
//   is bypassed whenever cookies ride along: a logged-in page must never
//   poison the anonymous copy in CF's cache.
//
// v5.26 — "some sites fail with key errors / unauthorized access":
//   1. Full browser-like request identity. Many sites (esp. Python
//      backends) do request.headers['Referer'] / ['Sec-Fetch-Mode'] and
//      CRASH with a bare KeyError when a header is absent; others 403
//      hotlink-protection when Referer is missing. We now send the full
//      navigation-grade set: sec-fetch-{mode,dest,site,user},
//      sec-ch-ua* client hints matched to the UA brand, and a SELF
//      referer (target's own origin — never leaks Kivora as referrer,
//      never leaks the user's URL to third parties).
//   2. Error responses are NEVER edge-cached: cacheTtl is replaced by
//      cacheTtlByStatus (mutually exclusive with cacheTtl) — 2xx cached
//      briefly, 404 for 30s, 401/403/429/5xx NOT AT ALL. A poisoned
//      "unauthorized" edge entry can no longer stick for an hour.
//   3. Upstream 4xx/5xx HTML is intercepted and replaced with the
//      branded error page (the site's own bot-challenge/HTTP-error page
//      is useless inside a sandboxed frame — its scripts can't finish).
//      The page gets Retry + Close buttons (Close posts the standard
//      agent-protocol envelope; BrowserApp handles type:'close').
//   4. &lang= (client locale) picks the error-page language with an
//      Accept-Language fallback.
//
// v5.25 NOTE on runtime context still applies: this route deliberately
// does NOT use getRequestContext()/caches.default/waitUntil. The
// installed @cloudflare/next-on-pages build exposes NO runtime exports
// from the bare specifier — a static import yields `undefined` and
// every request 500s. Edge caching rides on the fetch `cf` object,
// which is handled by the runtime BELOW the isolate and cannot throw.
//
// The jar rides in headers (never in the URL) and stays on the user's
// device — the proxy itself remains 100% stateless.
import { validateTarget, createStreamingRewriter, rewriteHtml, parseJar, serializeJar, cookiesForHost, mergeSetCookies } from '@/lib/browser/core.mjs'
import { AGENT_TAG } from '@/lib/browser/devtools-agent.mjs'

export const runtime = 'edge'

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const FETCH_TIMEOUT = 15000
const HTML_EDGE_TTL = 60 // seconds at Cloudflare's edge (fresh enough for news, fast enough to feel instant)
const HTML_BROWSER_TTL = 120 // browser HTTP cache for rewritten HTML (reload busts via &kb=)
const ASSET_BROWSER_TTL = 6 * 3600 // binaries through the proxy are stable per-URL

// Edge-cache policy by upstream status — the cf object is handled below
// the isolate. `0` = do not cache. cacheTtlByStatus is MUTUALLY
// EXCLUSIVE with cacheTtl, hence the replacement (v5.26: errors were
// edge-cached for the full TTL before — a poisoned unauthorized page
// could stick for everyone).
const EDGE_CACHE_BY_STATUS = {
  '200-299': HTML_EDGE_TTL,
  '404': 30, // missing assets/tooltip fetches get a short shield
  '401': 0,
  '403': 0,
  '429': 0,
  '500-599': 0,
}

// ── locale-aware error-page strings (inline: edge bundle stays lean) ──
const ERR_LOCALES = {
  en: {
    title: "This page couldn't be loaded",
    retry: 'Try again',
    back: 'Back to Kivora Browser',
    blocked: 'The address was blocked by Kivora Browser (unsupported scheme or non-public host).',
    net: 'The site refused the connection or does not exist.',
    timeout: 'The site took too long to respond (15s timeout).',
    auth: 'This site requires an account or refuses embedded browsers.',
    notfound: 'The page was not found on this site.',
    rate: 'The site is receiving too many requests right now — try again in a moment.',
    server: 'The site is having problems right now.',
    status: 'The site responded with an error.',
  },
  fr: {
    title: "Cette page n'a pas pu être chargée",
    retry: 'Réessayer',
    back: 'Retour au navigateur Kivora',
    blocked: "L'adresse a été bloquée par le navigateur Kivora (schéma non pris en charge ou hôte non public).",
    net: "Le site a refusé la connexion ou n'existe pas.",
    timeout: 'Le site a mis trop de temps à répondre (délai de 15 s dépassé).',
    auth: 'Ce site exige un compte ou refuse les navigateurs intégrés.',
    notfound: 'La page est introuvable sur ce site.',
    rate: 'Le site reçoit trop de requêtes — réessayez dans un instant.',
    server: 'Le site rencontre des problèmes en ce moment.',
    status: 'Le site a répondu avec une erreur.',
  },
  sw: {
    title: 'Ukurasa huu haukufunguliwa',
    retry: 'Jaribu tena',
    back: 'Rudi kwa Kivora Browser',
    blocked: 'Anwani imezuiwa na Kivora Browser (muundo usiotumika au mwenyeji asiye wa umma).',
    net: 'Tovuti imetakata muunganisho au haipo.',
    timeout: 'Tovuti imechukua muda mrefu kupitia (mpaka wa sekunde 15).',
    auth: 'Tovuti hii inahitaji akaunti au inazuia vivinjari vilivyopachikwa.',
    notfound: 'Ukurasa haupatikani kwenye tovuti hii.',
    rate: 'Tovuti inapokea maombi mengi mno — jaribu tena baada ya kidogo.',
    server: 'Tovuti ina matatizo kwa sasa.',
    status: 'Tovuti ilijibu kwa hitilafu.',
  },
  yo: {
    title: 'Ko ṣeé ṣiṣe láti gbé ojú-iṣẹ̀ yìí kalẹ̀',
    retry: 'Gbìyànjú lẹ́ẹ̀kansi',
    back: 'Padà sí Kivora Browser',
    blocked: 'Àdírẹ́sì yìí ti díwọ́ nípasẹ̀ Kivora Browser (èdè àmì tí kò tọ́ tàbí olùgbé tí kò wà ní gbangba).',
    net: 'Ojú-iṣẹ̀ náà kọ̀ láti bà ìbánisọ̀rọ̀ pọ̀ tàbí kò sí.',
    timeout: 'Ojú-iṣẹ̀ náà pẹ́ jù láti fèsì (ààyà díẹ 15).',
    auth: 'Ojú-iṣẹ̀ yìí nílò àkántì tàbí ó dì àwọn aṣàwákiri tí a fi sọ mó.',
    notfound: 'Ojú-iṣẹ̀ náà kò wà ní ojú-iṣẹ̀ yìí.',
    rate: 'Ojú-iṣẹ̀ náà ń gba àwọn ibẹ̀rẹ̀ púpọ̀ jù — gbìyànjú lẹ́ẹ̀kansi láìpẹ́.',
    server: 'Ojú-iṣẹ̀ náà ní ìṣòró ní báyìí.',
    status: 'Ojú-iṣẹ̀ náà dáhùn pẹ̀lú àṣìṣe.',
  },
}

function pickLocale(u, req) {
  const q = (u.searchParams.get('lang') || '').toLowerCase().slice(0, 2)
  if (q && ERR_LOCALES[q]) return q
  try {
    const al = (req.headers.get('accept-language') || '').toLowerCase()
    for (const part of al.split(',')) {
      const code = part.split(';')[0].trim().slice(0, 2)
      if (ERR_LOCALES[code]) return code
    }
  } catch {}
  return 'en'
}

function reasonFor(status) {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404 || status === 410) return 'notfound'
  if (status === 429) return 'rate'
  if (status >= 500) return 'server'
  return 'status'
}

function baseHeaders(extra) {
  return {
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'no-referrer',
    'x-kivora-proxy': '1',
    ...extra,
  }
}

// The service worker only talks to us, but defense in depth: strip any
// client-supplied jar header that didn't come through the SW path.
function jarFromRequest(req) {
  if (req.headers.get('x-kv-sw') !== '1') return {}
  return parseJar(req.headers.get('x-kv-jar') || '')
}

function errorPage(target, reasonKey, lang, opts = {}) {
  const L = ERR_LOCALES[lang] || ERR_LOCALES.en
  const safe = String(target || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const status = opts.status || ''
  const retry = opts.retryHref || 'javascript:void(0)'
  const extraHeaders = opts.extraHeaders || {}
  // Close posts the standard agent-protocol envelope (stringified — the
  // dock's message bus JSON.parses strings). BrowserApp maps type:'close'.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kivora Browser</title></head>
<body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
<div style="max-width:440px;text-align:center">
<div style="width:52px;height:52px;border-radius:16px;background:#141414;border:1px solid #262626;display:flex;align-items:center;justify-content:center;margin:0 auto 18px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3366" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></div>
${status ? `<div style="display:inline-block;padding:2px 10px;border-radius:999px;background:#1c1c1c;border:1px solid #2e2e2e;color:#FF3366;font-size:11px;font-weight:700;letter-spacing:.08em;margin-bottom:12px">HTTP ${status}</div>` : ''}
<h1 style="font-size:18px;font-weight:600;margin:0 0 8px">${L.title}</h1>
<p style="font-size:13px;line-height:1.6;color:#737373;margin:0 0 6px;word-break:break-all">${safe}</p>
<p style="font-size:12px;color:#525252;margin:0 0 22px">${L[reasonKey] || L.status}</p>
<div style="display:flex;gap:10px;justify-content:center">
<a href="${retry}" data-kv-retry="1" style="display:inline-block;padding:10px 22px;border-radius:12px;background:#FF3366;color:#fff;font-size:13px;font-weight:600;text-decoration:none">${L.retry}</a>
<button type="button" data-kv-close="1" style="display:inline-block;padding:10px 22px;border-radius:12px;background:#1a1a1a;border:1px solid #2e2e2e;color:#d4d4d4;font-size:13px;font-weight:600;cursor:pointer">${L.back}</button>
</div>
</div>
<script>(function(){var q=function(s){return document.querySelector(s)};
if(q('[data-kv-retry]')&&q('[data-kv-retry]').getAttribute('href')==='javascript:void(0)'){q('[data-kv-retry]').addEventListener('click',function(){try{location.replace(location.pathname+location.search+'&rj='+Date.now())}catch(e){}})}
var c=q('[data-kv-close]');if(c){c.addEventListener('click',function(){try{parent.postMessage(JSON.stringify({__kv_dt:1,side:'agent',type:'close'}),'*')}catch(e){}})}})()</script>
</body></html>`
  return new Response(html, {
    status: 200,
    headers: baseHeaders({ 'cache-control': 'no-store', 'content-type': 'text/html; charset=utf-8', ...extraHeaders }),
  })
}

function charsetOf(ct) {
  const m = /charset=([\w-]+)/i.exec(ct || '')
  return m ? m[1] : 'utf-8'
}

// ── navigation-grade request identity (v5.26) ──
// Sites crash (Python KeyError on missing headers) or 403 (hotlink /
// bot checks) when a "real browser" request lacks these. The referer is
// the TARGET'S OWN ORIGIN — satisfies self-referer checks without
// leaking anything about Kivora or the user to third parties.
// v5.30 — POST also sends Origin: same spoofed target origin, so CSRF
// validators (Django/Spring/Rails compare Origin first) pass.
function upstreamHeaders(req, target, desktop, isGet, cookieStr) {
  const origin = new URL(target).origin + '/'
  return {
    'user-agent': desktop ? DESKTOP_UA : MOBILE_UA,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9,fr;q=0.8,sw;q=0.7,yo;q=0.6',
    referer: origin,
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document',
    'sec-fetch-site': 'none',
    ...(isGet ? { 'sec-fetch-user': '?1' } : { origin: origin.replace(/\/$/, '') }),
    'sec-ch-ua': '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': desktop ? '?0' : '?1',
    'sec-ch-ua-platform': desktop ? '"Windows"' : '"Android"',
    'upgrade-insecure-requests': '1',
    ...(cookieStr ? { cookie: cookieStr } : {}),
    ...(req.headers.get('range') ? { range: req.headers.get('range') } : {}),
    ...(req.method === 'POST' && req.headers.get('content-type')
      ? { 'content-type': req.headers.get('content-type') }
      : {}),
  }
}

// Read every Set-Cookie from an upstream response (workerd exposes
// getSetCookie(); older runtimes only combine them into one header —
// naive comma-splitting breaks on Expires="Wed, 21 Oct 2026 …", so the
// fallback keeps the single combined value and the parser tolerates it).
function setCookiesOf(res) {
  try {
    if (typeof res.headers.getSetCookie === 'function') {
      const list = res.headers.getSetCookie()
      if (Array.isArray(list) && list.length) return list
    }
  } catch {}
  const one = res.headers.get('set-cookie')
  return one ? [one] : []
}

async function handle(req) {
  const t0 = Date.now()
  const u = new URL(req.url)
  const diag = u.searchParams.get('diag') === '1'
  const desktop = u.searchParams.get('ua') === 'desktop'
  const lang = pickLocale(u, req)
  const targetRaw = u.searchParams.get('url') || ''
  const isGet = req.method === 'GET'
  // v5.30 — per-browser-session id: the SW keys its cookie jar on it and
  // the rewriter propagates it into every rewritten link/form action so
  // the jar follows the user across the whole browsing session.
  const ks = (u.searchParams.get('ks') || '').replace(/[^\w-]/g, '').slice(0, 64)

  // ── SSRF wall ──
  const v = validateTarget(targetRaw)
  if (!v.ok) {
    if (diag) return Response.json({ ok: false, reason: v.reason }, { status: 403, headers: { 'cache-control': 'no-store' } })
    return errorPage(targetRaw, 'blocked', lang)
  }
  const target = v.url

  // ── Client cookie jar (SW-owned; see header comment) ──
  const jar = jarFromRequest(req)

  // ── Upstream fetch loop (v5.30: MANUAL redirect following) ──
  // redirect:'follow' hid every intermediate response, so the session
  // cookie a login POST receives on its 302 was silently dropped. Each
  // hop now gets: fresh SSRF validation, cookie attach for ITS host,
  // Set-Cookie capture, and 301/302/303 → GET conversion (307/308 keep
  // method + body).
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT)
  let body = req.method === 'POST' ? await req.arrayBuffer() : undefined
  let method = isGet ? 'GET' : 'POST'
  let currentTarget = target
  let jarIn = serializeJar(jar) !== '{}'
  let res = null
  let finalUrl = target
  try {
    for (let hop = 0; hop < 6; hop++) {
      const cookieStr = cookiesForHost(jar, new URL(currentTarget).hostname)
      const hopRes = await fetch(currentTarget, {
        method,
        headers: upstreamHeaders(req, currentTarget, desktop, method === 'GET', cookieStr),
        redirect: 'manual',
        signal: ac.signal,
        // Workers-only fetch option — silently ignored off-Cloudflare.
        // Edge cache ONLY on an anonymous first hop: a cookie-carrying
        // fetch must never poison the shared anonymous copy, and hops >0
        // are usually login/redirect endpoints (never worth caching).
        cf: hop === 0 && isGet && !desktop && !cookieStr
          ? { cacheEverything: true, cacheTtlByStatus: EDGE_CACHE_BY_STATUS }
          : undefined,
        body: method === 'POST' ? body : undefined,
      })
      const setCookies = setCookiesOf(hopRes)
      if (setCookies.length) mergeSetCookies(jar, setCookies, new URL(currentTarget).hostname)
      const loc = hopRes.status >= 300 && hopRes.status < 400 ? hopRes.headers.get('location') : null
      if (loc) {
        let next
        try {
          next = new URL(loc, currentTarget)
        } catch {
          res = hopRes
          finalUrl = currentTarget
          break
        }
        const nv = validateTarget(next.href)
        if (!nv.ok) {
          clearTimeout(timer)
          if (diag) return Response.json({ ok: false, reason: nv.reason, viaRedirect: true }, { status: 403, headers: { 'cache-control': 'no-store' } })
          return errorPage(next.href, 'blocked', lang)
        }
        currentTarget = nv.url
        if (hopRes.status === 301 || hopRes.status === 302 || hopRes.status === 303) {
          method = 'GET'
          body = undefined
        }
        if (hop === 5) {
          // Redirect budget exhausted — surface the chain's last hop verbatim
          res = hopRes
          finalUrl = currentTarget
          break
        }
        continue
      }
      res = hopRes
      finalUrl = res.url || currentTarget
      break
    }
    if (!res) throw new Error('redirect_loop')
  } catch (e) {
    clearTimeout(timer)
    const reasonKey = ac.signal.aborted ? 'timeout' : 'net'
    if (diag) return Response.json({ ok: false, reason: ac.signal.aborted ? 'timeout' : 'network_error', detail: String(e?.message || '').slice(0, 160) }, { status: 502, headers: { 'cache-control': 'no-store' } })
    return errorPage(currentTarget, reasonKey, lang)
  }
  clearTimeout(timer)

  const ct = (res.headers.get('content-type') || '').toLowerCase()
  // Every response carries the (possibly updated) jar back to the SW when
  // a session id is present — even error pages (login failures often
  // clear session cookies).
  const jarOutHeaders = ks ? { 'x-kv-cookies': serializeJar(jar) } : {}

  // ── Upstream 4xx/5xx: the site's own error/bot-challenge page is
  //    useless inside a sandboxed frame — replace with the branded,
  //    locale-aware page. diag returns machine-readable JSON (tests). ──
  if (res.status >= 400) {
    if (diag) {
      return Response.json(
        { ok: false, status: res.status, finalUrl, contentType: ct, ms: Date.now() - t0, reason: reasonFor(res.status) },
        { status: res.status, headers: { 'cache-control': 'no-store', ...jarOutHeaders } }
      )
    }
    if (ct.includes('text/html') || ct.includes('application/xhtml') || ct === '' || !ct.includes('/')) {
      const retryHref = `/api/browser/proxy?url=${encodeURIComponent(currentTarget)}${desktop ? '&ua=desktop' : ''}${ks ? `&ks=${ks}` : ''}&lang=${lang}&rj=${Date.now()}`
      return errorPage(currentTarget, reasonFor(res.status), lang, { status: res.status, retryHref, extraHeaders: jarOutHeaders })
    }
    // non-HTML 4xx (a missing image, etc.) — pass the status through
    return new Response(res.body, {
      status: res.status,
      headers: baseHeaders({ 'content-type': ct || 'application/octet-stream', 'cache-control': 'no-store', ...jarOutHeaders }),
    })
  }

  // ── HTML pipeline: STREAM + rewrite on the fly ──
  const isHtml = ct.includes('text/html') || ct.includes('application/xhtml')
  // v5.30 — the session id rides inside every rewritten navigation URL so
  // the SW can keep attaching the jar as the user browses the site.
  const buildHref = (abs) => `/api/browser/proxy?url=${encodeURIComponent(abs)}${ks ? `&ks=${ks}` : ''}`
  if (isHtml && res.body) {
    const enc = new TextEncoder()
    const dec = new TextDecoder(charsetOf(ct))
    const rewriter = createStreamingRewriter(finalUrl, buildHref, AGENT_TAG)

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
        // instant; explicit reloads bump &kb= and bypass this cache.
        // v5.30: cookie-carrying HTML is never browser-cached — a stale
        // logged-out copy on back/forward breaks the signed-in experience.
        ...jarOutHeaders,
        ...(isGet && !jarIn ? { 'cache-control': `private, max-age=${HTML_BROWSER_TTL}` } : { 'cache-control': 'no-store' }),
      }),
    })
  }

  // ── HTML but no body (204/HEAD-style) — degenerate passthrough ──
  if (isHtml) {
    return new Response(rewriteHtml('', finalUrl, buildHref, AGENT_TAG), {
      status: res.status,
      headers: baseHeaders({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...jarOutHeaders }),
    })
  }

  // ── Everything else streams through byte-for-byte ──
  // Range-aware passthrough: forward the headers media elements need to
  // seek (audio/video issue Range requests against the proxy URL).
  const rangeHeaders = {}
  for (const h of ['content-range', 'accept-ranges', 'content-length']) {
    const val = res.headers.get(h)
    if (val) rangeHeaders[h] = val
  }
  if (diag) {
    return Response.json(
      { ok: res.ok, status: res.status, finalUrl, contentType: ct, ms: Date.now() - t0, streamed: true, jarScopes: Object.keys(jar).length },
      { headers: { 'cache-control': 'no-store', ...jarOutHeaders } }
    )
  }
  return new Response(res.body, {
    status: res.status,
    headers: baseHeaders({
      'content-type': ct || 'application/octet-stream',
      ...(ct.includes('pdf') ? { 'content-disposition': 'inline' } : {}),
      ...rangeHeaders,
      ...jarOutHeaders,
      ...(isGet && !jarIn ? { 'cache-control': `private, max-age=${ASSET_BROWSER_TTL}` } : { 'cache-control': 'no-store' }),
    }),
  })
}

export async function GET(req) {
  return handle(req)
}

export async function POST(req) {
  return handle(req)
}
