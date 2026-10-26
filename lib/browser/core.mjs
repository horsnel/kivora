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

export function rewriteHtml(html, targetUrl, buildProxyHref) {
  if (!html || typeof html !== 'string') return html || ''
  let out = html

  // 1. Drop the site's own <base> and any CSP meta (both would fight us)
  out = out.replace(/<base\b[^>]*>/gi, '')
  out = out.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, '')

  // 2. Inject <base> + no-referrer right after <head> (or prepend)
  const inject = `<base href="${escAttr(targetUrl)}"><meta name="referrer" content="no-referrer">`
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, (m) => m + inject)
  } else {
    out = inject + out
  }

  // 3. Rewrite <a href> navigations through the proxy
  out = out.replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])(.*?)\2/gi, (m, pre, quote, href) => {
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

  // 4. Rewrite <form action> so GET and POST submissions stay proxied
  out = out.replace(/(<form\b[^>]*?\baction\s*=\s*)(["'])(.*?)\2/gi, (m, pre, quote, action) => {
    const a = action.trim()
    if (SKIP_HREF_RE.test(a)) return m
    let abs
    try {
      abs = a ? new URL(a, targetUrl).href : targetUrl
    } catch {
      return m
    }
    if (isBlockedHost(new URL(abs).hostname)) return m
    return `${pre}${quote}${buildProxyHref(abs)}${quote}`
  })
  // action-less forms: give them the proxy target explicitly
  out = out.replace(/<form\b(?![^>]*\baction\s*=)[^>]*>/gi, (m) =>
    m.replace(/<form/i, `<form action="${escAttr(buildProxyHref(targetUrl))}"`)
  )

  // 5. meta refresh redirects: "0; url=/next" → proxy the destination
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
