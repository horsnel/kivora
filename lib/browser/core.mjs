// ════════════════════════════════════════════════════════════════════
// core.mjs — Kivora Browser engine primitives (v5.24.6)
//
// Pure, dependency-free ESM shared by:
//   - /api/browser/proxy  (edge route: SSRF guard + HTML rewriting)
//   - /api/browser/reader (edge route: article extraction)
//   - scripts/browser_test.mjs (node logic tests)
//
// Kept as plain .mjs (no TS, no '@/' imports) so Node runs the tests
// directly and the edge bundle imports the exact same code the tests
// verified — one source of truth, zero drift.
// ════════════════════════════════════════════════════════════════════

// ── SSRF guard ──────────────────────────────────────────────────────
// The proxy fetches arbitrary URLs server-side. Before we ever call
// fetch(), the hostname must be a public internet host. Edge runtime
// has no DNS resolution, so we block every reserved-range LITERAL and
// internal-looking name; CF's egress additionally cannot reach private
// networks, making this defense-in-depth rather than the only wall.

function ipv4Blocked(h) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const o = m.slice(1).map(Number)
  if (o.some((n) => n > 255)) return true // malformed → refuse
  const [a, b] = o
  if (a === 0 || a === 10 || a === 127) return true // this-network, private, loopback
  if (a === 169 && b === 254) return true // link-local (cloud metadata!)
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reserved
  return false
}

function ipv6Blocked(raw) {
  let h = raw.replace(/^\[|\]$/g, '').toLowerCase()
  // IPv4-mapped (::ffff:10.0.0.1) — re-check the v4 tail
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h)
  if (mapped) return ipv4Blocked(mapped[1])
  h = h.split('%')[0] // drop zone id
  if (h === '::' || h === '::1') return true // unspecified, loopback
  const first = h.split(':')[0] || ''
  if (/^f[cd]/.test(first)) return true // unique local fc00::/7
  if (/^fe[89ab]/.test(first)) return true // link-local fe80::/10
  return false
}

export function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '')
  if (!h) return true
  if (h === 'localhost' || h === 'host.docker.internal') return true
  if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home')) return true
  if (h === 'metadata.google.internal') return true
  if (h.includes(':')) return ipv6Blocked(h)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return ipv4Blocked(h)
  // Decimal / octal / hex IP shorthands like 2130706433 or 0x7f000001
  if (/^(0x[0-9a-f]+|\d{8,})$/.test(h)) return true
  return false
}

// ── Tracker wall (v5.30.3) ──────────────────────────────────────────
// Two layers, applied by the proxy BEFORE any upstream fetch:
//   1. URL hygiene — strip cross-site tracking params (utm_*, fbclid,
//      gclid, …) so sites never see the stalk-you-across-sites tail.
//   2. Beacon blocking — pure analytics/ad endpoints get an empty 204
//      instead of a fetch. Pages load faster and the upstream site's
//      trackers never fire. Error-reporting (Sentry) and payment SDKs
//      are deliberately NOT on the list.
export const TRACKER_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_cid', 'utm_reader', 'utm_user', 'utm_social', 'utm_brand',
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'dclid', 'msclkid', 'twclid',
  'ttclid', 'igshid', 'li_fat_id', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi',
  'vero_id', 'vero_conv', 'wickedid', 's_kwcid', 'pk_cid',
])

export function stripTrackers(href) {
  if (!href || typeof href !== 'string') return href
  const q = href.indexOf('?')
  const h = href.indexOf('#')
  if (q === -1 || (h !== -1 && h < q)) return href
  try {
    const u = new URL(href)
    let touched = false
    for (const p of [...u.searchParams.keys()]) {
      if (TRACKER_PARAMS.has(p.toLowerCase())) {
        u.searchParams.delete(p)
        touched = true
      }
    }
    return touched ? u.href : href
  } catch {
    return href
  }
}

export const TRACKER_HOST_SUFFIXES = [
  'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com',
  'googleadservices.com', 'doubleclick.net', 'adservice.google.com',
  'facebook.net', 'connect.facebook.net', 'scorecardresearch.com',
  'quantserve.com', 'hotjar.com', 'hotjar.io', 'clarity.ms',
  'mixpanel.com', 'segment.io', 'segment.com', 'amplitude.com',
  'fullstory.com', 'chartbeat.com', 'parsely.com', 'criteo.com',
  'criteo.net', 'taboola.com', 'outbrain.com', 'pubmatic.com',
  'rubiconproject.com', 'adnxs.com', 'casalemedia.com', 'openx.net',
  'smartadserver.com', 'adsrvr.org', 'sharethrough.com', 'bidswitch.net',
  'mc.yandex.ru', 'nr-data.net', 'js-agent.newrelic.com', 'bam.nr-data.net',
]

export function isTrackerHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '')
  if (!h) return false
  return TRACKER_HOST_SUFFIXES.some((s) => h === s || h.endsWith('.' + s))
}

// ── Cookie jar primitives (v5.30) ───────────────────────────────────
// Kivora Browser sign-in support. The proxy is stateless by design, so
// the cookie jar lives on the CLIENT: the service worker stores it (per
// browser-session id `ks`, Cache API), hands it to the proxy on every
// request via `x-kv-jar`, and the proxy returns the updated jar via
// `x-kv-cookies` after capturing upstream Set-Cookie at EVERY redirect
// hop. These helpers are pure functions so Node tests verify the exact
// logic the edge route runs.
//
// Jar shape (JSON): { [scope]: [{ n, v, exp? }] } where scope is the
// host-only host or the Domain-attribute domain (leading dot stripped).
// A scope applies to host when host === scope || host.endsWith('.'+scope).
//
// Security notes:
//  - Values are capped and the whole jar is capped (small enough to ride
//    in a request header; no DB, no server-side session state).
//  - The response header is NOT CORS-safelisted, so page JS inside the
//    sandboxed (opaque-origin) iframe can never read the jar — only the
//    service worker (same-origin fetch context) sees it.

const JAR_MAX_SCOPES = 24
const JAR_MAX_COOKIES_PER_SCOPE = 50
const JAR_MAX_VALUE = 2048
const JAR_MAX_TOTAL_JSON = 12 * 1024

export function parseJar(json) {
  if (!json) return {}
  try {
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    const out = {}
    for (const [scope, list] of Object.entries(obj)) {
      if (!Array.isArray(list)) continue
      out[String(scope).slice(0, 253).toLowerCase()] = list
        .filter((c) => c && typeof c === 'object' && typeof c.n === 'string' && typeof c.v === 'string')
        .slice(0, JAR_MAX_COOKIES_PER_SCOPE)
        .map((c) => ({ n: c.n.slice(0, 128), v: c.v.slice(0, JAR_MAX_VALUE), ...(c.exp ? { exp: c.exp } : {}) }))
    }
    return out
  } catch {
    return {}
  }
}

export function serializeJar(jar) {
  try {
    let json = JSON.stringify(jar || {})
    // Hard cap: drop the oldest scopes (insertion order) until it fits
    while (json.length > JAR_MAX_TOTAL_JSON) {
      const keys = Object.keys(jar)
      if (!keys.length) break
      delete jar[keys[0]]
      json = JSON.stringify(jar)
    }
    return json
  } catch {
    return '{}'
  }
}

function hostMatchesScope(host, scope) {
  return host === scope || host.endsWith('.' + scope)
}

// jar → "n=v; n=v" cookie header for a given host (expired entries dropped)
export function cookiesForHost(jar, host) {
  const h = String(host || '').toLowerCase()
  if (!h || !jar) return ''
  const now = Date.now()
  const seen = new Set()
  const parts = []
  for (const scope of Object.keys(jar)) {
    if (!hostMatchesScope(h, scope)) continue
    for (const c of jar[scope] || []) {
      if (!c || typeof c.n !== 'string') continue
      if (c.exp && Date.parse(c.exp) <= now) continue
      if (seen.has(c.n)) continue // first scope wins — deterministic
      seen.add(c.n)
      parts.push(`${c.n}=${c.v}`)
      if (parts.join('; ').length > 6144) return parts.join('; ')
    }
  }
  return parts.join('; ')
}

function parseSetCookie(str) {
  const firstSeg = String(str || '').split(';')[0]
  const eq = firstSeg.indexOf('=')
  if (eq < 1) return null
  const n = firstSeg.slice(0, eq).trim()
  const v = firstSeg.slice(eq + 1).trim()
  if (!n || !/^[^\x00-\x20()<>@,;:\\"/[\]?={}\x7f]+$/.test(n)) return null
  const attrs = String(str || '').split(';').slice(1)
  let domain = ''
  let maxAge = null
  let expires = null
  for (const raw of attrs) {
    const seg = raw.trim()
    const [kRaw, vRaw = ''] = seg.split('=')
    const k = kRaw.trim().toLowerCase()
    if (k === 'domain' && vRaw.trim()) domain = vRaw.trim().replace(/^\./, '').toLowerCase()
    else if (k === 'max-age') maxAge = Number(vRaw.trim())
    else if (k === 'expires') expires = vRaw.trim()
  }
  return { n, v, domain, maxAge, expires }
}

// Merge upstream Set-Cookie headers (captured at every redirect hop) into
// the jar map. Expired cookies delete; fresh ones upsert per scope.
export function mergeSetCookies(jar, setCookieList, finalHost) {
  const host = String(finalHost || '').toLowerCase()
  if (!host || !Array.isArray(setCookieList)) return jar
  const now = Date.now()
  for (const raw of setCookieList) {
    const c = parseSetCookie(raw)
    if (!c) continue
    let scope = host
    if (c.domain) {
      // A Domain attribute only applies if it suffix-matches the final host
      if (host === c.domain || host.endsWith('.' + c.domain)) scope = c.domain
      else continue // third-party cookie for an unrelated domain — ignore
    }
    const expired =
      (c.maxAge != null && c.maxAge <= 0) ||
      (c.expires && Date.parse(c.expires) <= now)
    // Remove same-name entries in every scope that would deliver to host
    // (host-only and Domain cookies with one name would otherwise coexist
    // and both ride the header — sites see duplicates and misbehave)
    for (const s of Object.keys(jar)) {
      if (!hostMatchesScope(host, s)) continue
      jar[s] = (jar[s] || []).filter((x) => x.n !== c.n)
      if (!jar[s].length) delete jar[s]
    }
    if (expired) continue
    if (c.maxAge != null && c.maxAge > 0) {
      // Convert Max-Age to an absolute expiry (seconds)
      c.exp = new Date(now + Math.min(c.maxAge, 400 * 24 * 3600) * 1000).toISOString()
    } else if (c.expires) {
      c.exp = c.expires
    }
    const arr = jar[scope] || (jar[scope] = [])
    const i = arr.findIndex((x) => x.n === c.n)
    const entry = { n: c.n.slice(0, 128), v: c.v.slice(0, JAR_MAX_VALUE), ...(c.exp ? { exp: c.exp } : {}) }
    if (i >= 0) arr[i] = entry
    else arr.push(entry)
    if (arr.length > JAR_MAX_COOKIES_PER_SCOPE) arr.splice(0, arr.length - JAR_MAX_COOKIES_PER_SCOPE)
  }
  // Scope-count cap
  const scopes = Object.keys(jar)
  if (scopes.length > JAR_MAX_SCOPES) {
    for (const s of scopes.slice(0, scopes.length - JAR_MAX_SCOPES)) delete jar[s]
  }
  return jar
}

// ── Target validation ───────────────────────────────────────────────
// Returns { ok, url } or { ok:false, reason }. `url` is the normalized
// absolute href. Everything the proxy/reader will honor must pass here.

export function validateTarget(raw) {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'missing_url' }
  const trimmed = raw.trim()
  if (trimmed.length > 2048) return { ok: false, reason: 'url_too_long' }
  let u
  try {
    u = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'bad_url' }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'bad_scheme' }
  if (u.username || u.password) return { ok: false, reason: 'credentials' }
  if (isBlockedHost(u.hostname)) return { ok: false, reason: 'blocked_host' }
  return { ok: true, url: u.href }
}

// ── Omnibox normalization (shared with the client) ──────────────────
// "kivora browser" → search engine; "wikipedia.org" → https://wikipedia.org.
// Mirrored in the client component; kept here so tests cover the exact
// same rules users experience.

const TLD_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i

export function normalizeInput(raw, searchEngine) {
  const q = String(raw || '').trim()
  if (!q) return { url: '', isSearch: false }
  if (/^https?:\/\//i.test(q)) return { url: q, isSearch: false }
  // bare domain (optionally with path/query) and no whitespace
  const noSlash = q.replace(/^\/+/, '')
  if (!/\s/.test(noSlash)) {
    const hostPart = noSlash.split(/[/?#]/)[0]
    if (TLD_RE.test(hostPart) || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostPart)) {
      return { url: 'https://' + noSlash, isSearch: false }
    }
    if (/^www\./i.test(hostPart)) return { url: 'https://' + noSlash, isSearch: false }
  }
  const engine = searchEngine || 'https://duckduckgo.com/html/?q={q}' // lightweight HTML endpoint — proxy-friendly
  return { url: engine.replace('{q}', encodeURIComponent(q)), isSearch: true }
}

// ── HTML rewriting ──────────────────────────────────────────────────
// Strategy: the proxy serves HTML from OUR origin inside a sandboxed
// (opaque-origin) iframe. Relative resources are pinned to the real
// site with an injected <base> so images/CSS load straight from the
// source host, while NAVIGATIONS (links + GET/POST form actions) are
// re-routed through the proxy so browsing stays inside Kivora.

const SKIP_HREF_RE = /^(#|javascript:|mailto:|tel:|sms:|data:|blob:|about:|intent:|market:|whatsapp:)/i

export function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Extract an attribute value from a full opening-tag string (null = absent).
function attrVal(tag, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  if (!m) return null
  return m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] || ''
}

export function rewriteHtml(html, targetUrl, buildProxyHref, extraHead = '', opts = {}) {
  if (!html || typeof html !== 'string') return html || ''
  const desktop = !!opts.desktop
  let out = html

  // 1. Drop the site's own <base> and any CSP meta (both would fight us).
  //    Desktop mode also drops the site's viewport meta — width=device-width
  //    pins responsive layouts to the iframe's narrow width; our injected
  //    width=1280 makes them lay out desktop-wide and zoom-to-fit.
  out = out.replace(/<base\b[^>]*>/gi, '')
  out = out.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, '')
  if (desktop) out = out.replace(/<meta[^>]+name\s*=\s*["']?viewport["']?[^>]*>/gi, '')

  // 2. Inject <base> + no-referrer (+ caller's extra, e.g. the DevTools
  //    agent script) right after <head> (or prepend)
  const inject = `<base href="${escAttr(targetUrl)}"><meta name="referrer" content="no-referrer">${desktop ? '<meta name="viewport" content="width=1280">' : ''}${extraHead}`
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, (m) => m + inject)
  } else {
    out = inject + out
  }

  // 3-5. Navigations → proxy (shared with the streaming rewriter)
  return rewriteBodyAttrs(out, targetUrl, buildProxyHref, opts)
}

// ── Body-level rewrites (a / form / meta-refresh) ────────────────────
// The exact rules from v5.24.6, factored out so the buffered rewriter
// and the incremental streaming rewriter share ONE implementation —
// the streaming path rewrites the very same bytes the tests verify.
function rewriteBodyAttrs(out, targetUrl, buildProxyHref, opts = {}) {
  // Quoted-aware tag scanning: attribute values may legally contain ">",
  // so the tag-body alternation skips over quoted runs instead of stopping
  // at the first ">" (v5.25 — matches the streaming tag-boundary splitter).
  // Rewrite <a href> navigations through the proxy
  out = out.replace(/(<a\b(?:"[^"]*"|'[^']*'|[^"'>])*?\bhref\s*=\s*)(["'])(.*?)\2/gi, (m, pre, quote, href) => {
    const h = href.trim()
    if (!h || SKIP_HREF_RE.test(h)) return m
    let abs
    try {
      abs = new URL(h, targetUrl).href
    } catch {
      return m
    }
    if (isBlockedHost(new URL(abs).hostname)) return m
    return `${pre}${quote}${buildProxyHref(abs)}${quote}`
  })

  // v5.30.4 — forms in ONE pass: parse action + method, then either keep
  // a query-bearing action (POST — the query survives the submission) or
  // switch to the bare proxy path + hidden carrier inputs (GET — a GET
  // submission REPLACES the whole query string, so url/ks/ua must ride
  // the body as hidden inputs or the proxy loses its target entirely).
  out = out.replace(/<form\b(?:"[^"]*"|'[^']*'|[^"'>])*>/gi, (tag) => {
    const actionM = /\baction\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(tag)
    const aRaw = actionM ? (actionM[2] != null ? actionM[2] : actionM[3] != null ? actionM[3] : actionM[4] || '') : null
    const method = (attrVal(tag, 'method') || 'get').toLowerCase()
    let abs = targetUrl
    if (aRaw != null) {
      const a = aRaw.trim()
      if (SKIP_HREF_RE.test(a)) return tag
      try {
        abs = a ? new URL(a, targetUrl).href : targetUrl
      } catch {
        return tag
      }
      if (isBlockedHost(new URL(abs).hostname)) return tag
    }
    if (method === 'get') {
      const hidden = opts.formHidden
        ? opts.formHidden(abs)
        : `<input type="hidden" name="url" value="${escAttr(abs)}">`
      let t = actionM
        ? tag.replace(/\baction\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/i, 'action="/api/browser/proxy"')
        : tag.replace(/<form/i, '<form action="/api/browser/proxy"')
      return t + hidden
    }
    const proxied = escAttr(buildProxyHref(abs))
    return actionM
      ? tag.replace(/\baction\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/i, `action="${proxied}"`)
      : tag.replace(/<form/i, `<form action="${proxied}"`)
  })

  // meta refresh redirects: "0; url=/next" → proxy the destination
  out = out.replace(
    /(<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["'])([^"']*)(["'])/gi,
    (m, pre, content, quote) => {
      const mm = /url\s*=\s*(.+)$/i.exec(content)
      if (!mm) return m
      let abs
      try {
        abs = new URL(mm[1].trim().replace(/^["']|["']$/g, ''), targetUrl).href
      } catch {
        return m
      }
      if (isBlockedHost(new URL(abs).hostname)) return m
      return `${pre}${content.replace(mm[0], 'url=' + buildProxyHref(abs))}${quote}`
    }
  )

  return out
}

// ── Streaming rewrite (v5.25) ─────────────────────────────────────────
// First-byte latency is the single biggest "browser feels slow" factor,
// so the proxy no longer waits for the whole document: HTML is rewritten
// AS IT ARRIVES from the upstream site.
//
//   Phase A (head)   — buffer until </head> (or 96 KB degenerate cap),
//                      then run the full buffered rewriteHtml ONCE. This
//                      is where <base>, CSP-meta drops, and the DevTools
//                      agent injection happen; head markup is tiny, so
//                      the cost is negligible and the rules stay unified.
//   Phase B (body)   — every chunk is split at the last tag boundary
//                      that is OUTSIDE quoted attribute values; complete
//                      tags get the shared body rewrites, the trailing
//                      partial tag is carried into the next chunk.
//   end()            — flushes any carried tail through the same rules.
//
// Failure mode of a pathological page (e.g. a tag whose attribute value
// contains a quoted ">" that spans chunk borders): the affected tag may
// pass through un-rewritten — navigation falls back to <base> resolution.
// Cosmetic degradation only; bytes are never corrupted.

const HEAD_CLOSE_RE = /<\/head\s*>/i
const HEAD_CAP = 96 * 1024

// Split a chunk into [completeRegion, carry]: the boundary is the last
// ">" not inside double/single quotes. Returns null when the whole chunk
// is inside an unterminated tag (everything carries over).
function splitAtTagBoundary(s) {
  let quote = null
  let last = -1
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (quote) {
      if (c === quote.charCodeAt(0)) quote = null
    } else if (c === 34 || c === 39) {
      quote = s[i]
    } else if (c === 62) {
      last = i
    }
  }
  if (last < 0) return null
  return [s.slice(0, last + 1), s.slice(last + 1)]
}

export function createStreamingRewriter(targetUrl, buildProxyHref, extraHead = '', opts = {}) {
  let phase = 'head' // 'head' | 'body'
  let headBuf = ''
  let carry = ''

  const push = (decoded) => {
    if (!decoded) return ''
    if (phase === 'head') {
      headBuf += decoded
      if (!HEAD_CLOSE_RE.test(headBuf) && headBuf.length < HEAD_CAP) return ''
      const headDone = HEAD_CLOSE_RE.test(headBuf)
        ? headBuf.indexOf(headBuf.match(HEAD_CLOSE_RE)[0]) + headBuf.match(HEAD_CLOSE_RE)[0].length
        : headBuf.length
      let headPart = headBuf.slice(0, headDone)
      const rest = headBuf.slice(headDone)
      headBuf = ''
      phase = 'body'
      // buffered rules for the head (base/agent injection + CSP drops);
      // head rarely carries <a>/<form>, but running the body rules keeps
      // behavior identical to the v5.24.6 buffered pipeline.
      const rewrittenHead = rewriteHtml(headPart, targetUrl, buildProxyHref, extraHead, opts)
      return rewrittenHead + push(rest)
    }
    const chunk = carry + decoded
    carry = ''
    const split = splitAtTagBoundary(chunk)
    if (!split) {
      carry = chunk
      return ''
    }
    const [complete, tail] = split
    carry = tail
    return rewriteBodyAttrs(complete, targetUrl, buildProxyHref, opts)
  }

  const end = () => {
    let out = ''
    if (phase === 'head') {
      // degenerate page with no </head> — flush everything buffered
      phase = 'body'
      out += rewriteHtml(headBuf, targetUrl, buildProxyHref, extraHead, opts)
      headBuf = ''
    }
    if (carry) {
      out += rewriteBodyAttrs(carry, targetUrl, buildProxyHref, opts)
      carry = ''
    }
    return out
  }

  return { push, end }
}

// ── Title extraction ────────────────────────────────────────────────

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n))
      } catch {
        return ''
      }
    })
}

export function extractTitle(html) {
  if (!html) return ''
  const og = /<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']*)["']/i.exec(html)
  if (og && og[1].trim()) return decodeEntities(og[1].trim()).slice(0, 200)
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (t) return decodeEntities(t[1].replace(/\s+/g, ' ').trim()).slice(0, 200)
  return ''
}

// ── Reader-mode extraction ──────────────────────────────────────────
// Server-side "readability": strip chrome (scripts, nav, footer…), pick
// the best container, whitelist harmless tags, absolutize img/a URLs.

const STRIP_WITH_CONTENT_RE =
  /<(script|style|noscript|svg|canvas|iframe|object|embed|template|form|button|select|textarea|video|audio|dialog|nav|header|footer|aside|head|title)[^>]*>[\s\S]*?<\/\1>/gi
const STRIP_VOID_RE = /<(link|meta|input|source|track)\b[^>]*>/gi

const KEEP_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'br', 'img', 'a', 'strong', 'b', 'em', 'i', 'u', 'small', 'sup', 'sub', 'table',
  'thead', 'tbody', 'tr', 'td', 'th', 'figure', 'figcaption', 'caption', 'strike', 'dl', 'dt', 'dd',
])

function sanitizeKept(chunk, baseUrl) {
  // Walk every tag; keep whitelisted ones (attributes reduced to safe
  // essentials), drop everything else. Text nodes pass through untouched.
  return chunk
    .replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)>/g, (m, tag, attrs) => {
      const t = tag.toLowerCase()
      if (!KEEP_TAGS.has(t)) return ''
      if (t === 'img') {
        const srcM = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs)
        let src = (srcM && (srcM[2] || srcM[3])) || ''
        if (!src || SKIP_HREF_RE.test(src.trim())) return ''
        try {
          src = new URL(src.trim(), baseUrl).href
        } catch {
          return ''
        }
        const altM = /\salt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs)
        const alt = escAttr(decodeEntities((altM && (altM[2] || altM[3])) || '')).slice(0, 300)
        return `<img src="${escAttr(src)}" alt="${alt}" loading="lazy">`
      }
      if (t === 'a') {
        const hrefM = /\shref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs)
        let href = (hrefM && (hrefM[2] || hrefM[3])) || ''
        if (!href || SKIP_HREF_RE.test(href.trim())) return '<a>'
        try {
          href = new URL(href.trim(), baseUrl).href
        } catch {
          return '<a>'
        }
        return `<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">`
      }
      return `<${t}>`
    })
    .replace(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g, (m, tag) => (KEEP_TAGS.has(tag.toLowerCase()) ? `</${tag.toLowerCase()}>` : ''))
}

export function extractArticle(html, baseUrl) {
  if (!html || typeof html !== 'string') return null
  let work = html.replace(STRIP_WITH_CONTENT_RE, '').replace(STRIP_VOID_RE, '')

  // Candidate containers, best first: <article>s, <main>, <body>, whole doc
  const candidates = []
  const artRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi
  let m
  while ((m = artRe.exec(work))) candidates.push(m[1])
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(work)
  if (main) candidates.push(main[1])
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(work)
  if (body) candidates.push(body[1])
  candidates.push(work)

  let best = ''
  for (const c of candidates) {
    const textLen = c.replace(/<[^>]+>/g, '').trim().length
    if (textLen > best.replace(/<[^>]+>/g, '').trim().length) best = c
    if (textLen > 400) break // good enough — stop scanning
  }

  const title = extractTitle(html)
  const clean = sanitizeKept(best, baseUrl)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/(<br>\s*){3,}/gi, '<br><br>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const wordCount = clean.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  if (wordCount < 25) return { title, html: '', wordCount }
  return { title, html: clean, wordCount }
}
