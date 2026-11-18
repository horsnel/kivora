// ════════════════════════════════════════════════════════════════════
// lib/browser/render.mjs — Cloudflare Browser Run client (v5.30.30)
//
// Server-side rendering escalation for Kivora's browser stack. The plain
// fetch path (raw proxy + Jina reader) cannot execute page JavaScript, so
// SPA pages come back as an empty framework shell. This module talks to
// Cloudflare's HOSTED Browser Run Quick Actions REST API — with the
// Kitesurf engine requested — to get the post-JS DOM, markdown, and
// screenshots. No self-hosted engine, no Workers Paid plan, no Bazel.
//
//   POST /client/v4/accounts/<id>/browser-run/snapshot
//     body: { url, formats: [≥2 of content|screenshot|markdown|
//             accessibilityTree], viewport, gotoOptions,
//             screenshotOptions, userAgent, browser: 'kitesurf' }
//     → { success, result: { content, screenshot(b64), markdown,
//         accessibilityTree }, meta: { status, title } }
//   Auth: Bearer CF_API_TOKEN with the "Browser Run - Edit" permission.
//   Every response carries X-Browser-Ms-Used: browser milliseconds
//   billed for the request — the module accumulates it into a UTC-day
//   budget so the Free plan's 10 minutes/day is never blown in one burst.
//
// Robustness against API surface drift (both verified against the
// official docs, which show the service mid-rename):
//   - Path: /browser-run/… is the current name, /browser-rendering/… the
//     legacy one. The first success pins the prefix for the isolate; a
//     404 on the pinned prefix clears the pin so the other is retried.
//   - Engine: body.browser='kitesurf' is documented for the Workers
//     binding; REST support is not explicitly documented. Send it, and
//     on HTTP 400 retry the identical request WITHOUT it — the request
//     then runs on the managed default engine instead of failing.
//
// Consumers:
//   - toolRegistry readUrl chain (read_url / web_scrape tools):
//     Jina first (free, no quota) → looksLikeJsShell gate → Browser Run
//     escalation → degrade back to Jina's imperfect text.
//   - app/api/browser/reader: readability escalation for JS-shell pages.
//   - app/api/browser/proxy: &render=1 static snapshot mode.
//   - toolRegistry screenshot_page tool: real rendered screenshots.
//
// This module is deliberately credential-free: callers pass { accountId,
// apiToken } (from getEnvVar) so it stays pure and unit-testable with a
// stubbed fetch. Module-level budget state is per-isolate, same lifetime
// model as the image-provider cooldowns in toolRegistry.
// ════════════════════════════════════════════════════════════════════

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts'

// Free plan gives 10 minutes of browser time per day (Quick Actions are
// billed only in browser hours — the X-Browser-Ms-Used header). The soft
// cap stops escalations with a safety margin instead of waiting for the
// hard quota error.
const DAILY_SOFT_CAP_MS = 8 * 60 * 1000

// Per-isolate memories — first success pins them for the isolate's life.
let _pathPrefix = null // '/browser-run' once a snapshot succeeded there
let _engineParamWorks = null // false once a 400 retry-without succeeded

const _budget = { day: '', usedMs: 0 }

export function budgetState() {
  const day = new Date().toISOString().slice(0, 10)
  if (_budget.day !== day) {
    _budget.day = day
    _budget.usedMs = 0
  }
  return { day: _budget.day, usedMs: _budget.usedMs, capMs: DAILY_SOFT_CAP_MS }
}

export function underBudget() {
  return budgetState().usedMs < DAILY_SOFT_CAP_MS
}

export function recordBrowserMs(ms) {
  const s = budgetState()
  const v = Number(ms)
  _budget.usedMs = s.usedMs + (Number.isFinite(v) && v > 0 ? Math.round(v) : 0)
}

export function resetBudgetForTests() {
  _budget.day = ''
  _budget.usedMs = 0
}

export function isBrowserRunConfigured(creds) {
  return Boolean(creds && creds.apiToken && creds.accountId)
}

// ── JS-shell gate ─────────────────────────────────────────────────────
// Decides whether a fetched page needs real rendering. Handles BOTH
// input shapes the call sites feed it: raw HTML (proxy/reader) and the
// markdown Jina returns (read chain).
const CHALLENGE_TEXT = [
  /just a moment\.\.\.?/i, // Cloudflare managed challenge
  /checking your browser/i,
  /you need to (?:enable|turn on) javascript/i,
  /enable (?:javascript|js) (?:to run|in your browser|and reload|is disabled)/i,
  /access (?:to this (?:page|content|site) )?(?:is|has been) denied/i,
  /verify you (?:are|'re) (?:a )?human/i,
  /are you a robot\??/i,
  /enable javascript and cookies to continue/i,
]
const SHELL_MARKERS = [
  // empty framework mount points — the JS never painted content
  /<div[^>]+id=["'](?:root|app|__next|__nuxt|q-app)["'][^>]*>\s*<\/div>/i,
  /<div[^>]+id=["'](?:root|app|__next|__nuxt|q-app)["'][^>]*>\s*(?:<div[^>]*>\s*<\/div>\s*)+$/im,
  /<noscript>[\s\S]{0,400}(enable javascript|javascript is (?:disabled|required|turned off))/i,
]
export function looksLikeJsShell(text) {
  const t = String(text || '')
  if (!t.trim()) return true
  if (CHALLENGE_TEXT.some(re => re.test(t))) return true
  if (SHELL_MARKERS.some(re => re.test(t))) return true
  // very little real text — markup/markdown/URLs don't count
  const texty = t
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#*_`>~[\]()|!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (texty.length >= 400) return false
  // v5.30.31 — below the threshold, HTML only counts as a shell when
  // SCRIPTS dominate the page: a tiny script-less page is just a small
  // real page (a 300-char note must render, not error). Plain-text
  // (markdown) short reads stay suspicious — Jina's thin outputs are
  // almost always challenge pages, and escalation never makes them worse.
  if (/<script\b/i.test(t)) return true
  return !/<[a-z!/]/i.test(t)
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripScriptsForSnapshot(html) {
  return String(html || '')
    // the snapshot content already RAN — re-running client-side in the
    // sandboxed iframe just recreates the broken state
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
}

// ── Jina reader (the cheap, no-quota first leg) ───────────────────────
export async function jinaRead(url, fetchImpl, timeoutMs = 12000) {
  try {
    const f = fetchImpl || fetch
    const res = await f(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.ok) {
      const text = await res.text()
      return text && text.trim() ? text.slice(0, 15000) : null
    }
  } catch {}
  return null
}

function pickBrowserMs(res) {
  const v = Number(res.headers?.get?.('x-browser-ms-used'))
  if (Number.isFinite(v) && v > 0) {
    recordBrowserMs(v)
    return Math.round(v)
  }
  return 0
}

// ── Browser Run /snapshot ─────────────────────────────────────────────
// Returns { ok, status, title, content, markdown, screenshotB64,
// accessibilityTree, browserMs, error, reason }. Never throws.
export async function browserRunSnapshot(url, creds, opts = {}) {
  const f = opts.fetchImpl || fetch
  if (!isBrowserRunConfigured(creds)) return { ok: false, error: 'not_configured' }
  if (!underBudget()) return { ok: false, error: 'budget_exhausted', browserMs: 0 }

  // The endpoint requires at least two formats — pad a single-format
  // request instead of discarding the caller's intent.
  const formats = Array.isArray(opts.formats) && opts.formats.length >= 2
    ? opts.formats
    : Array.isArray(opts.formats) && opts.formats.length === 1
      ? (opts.formats[0] === 'markdown' ? ['markdown', 'content'] : [opts.formats[0], 'markdown'])
      : ['content', 'markdown']
  const payload = {
    url,
    formats,
    ...(opts.viewport ? { viewport: opts.viewport } : {}),
    ...(opts.gotoOptions ? { gotoOptions: opts.gotoOptions } : {}),
    ...(opts.screenshotOptions ? { screenshotOptions: opts.screenshotOptions } : {}),
    ...(opts.userAgent ? { userAgent: opts.userAgent } : {}),
  }
  // Engine selection: kitesurf where the API accepts it. _engineParamWorks
  // === false means a previous request taught us REST rejects the field.
  const wantEngine = opts.engine !== false && _engineParamWorks !== false

  // Prefix candidates: the pinned prefix first; its alternate stays in the
  // list so a mid-flight 404 (project rename rollback) still recovers by
  // trying the other one — a success re-pins for the rest of the isolate.
  const prefixes = _pathPrefix
    ? [_pathPrefix, _pathPrefix === '/browser-run' ? '/browser-rendering' : '/browser-run']
    : ['/browser-run', '/browser-rendering']
  let lastStatus = 0
  let lastErr = ''

  for (const prefix of prefixes) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const withEngine = wantEngine && attempt === 0
      const body = withEngine ? { ...payload, browser: opts.engine || 'kitesurf' } : payload
      try {
        const res = await f(`${API_BASE}/${creds.accountId}${prefix}/snapshot`, {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${creds.apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(opts.timeoutMs || 45000),
        })
        const browserMs = pickBrowserMs(res)
        if (res.status === 404) {
          // unknown/legacy path — try the next prefix; clear any stale pin
          _pathPrefix = null
          lastStatus = 404
          lastErr = `404 on ${prefix}/snapshot`
          break
        }
        if (res.status === 400 && withEngine) {
          // the engine field may not be accepted on REST — retry the
          // identical request on the default engine before giving up
          _engineParamWorks = false
          continue
        }
        _pathPrefix = prefix
        if (!res.ok) {
          let detail = ''
          try { detail = (await res.text()).slice(0, 200) } catch {}
          return { ok: false, error: `http_${res.status}`, reason: 'upstream', detail, browserMs }
        }
        let data = null
        try { data = await res.json() } catch (e) {
          return { ok: false, error: 'bad_json', reason: 'upstream', browserMs }
        }
        if (!data?.success) {
          return { ok: false, error: 'api_unsuccessful', reason: 'upstream', detail: JSON.stringify(data).slice(0, 200), browserMs }
        }
        const r = data.result || {}
        return {
          ok: true,
          status: data.meta?.status,
          title: data.meta?.title || '',
          content: typeof r.content === 'string' ? r.content : '',
          markdown: typeof r.markdown === 'string' ? r.markdown : '',
          screenshotB64: typeof r.screenshot === 'string' ? r.screenshot : '',
          accessibilityTree: r.accessibilityTree || null,
          browserMs,
          engineUsed: withEngine ? (opts.engine || 'kitesurf') : 'default',
        }
      } catch (e) {
        lastStatus = 0
        lastErr = String(e?.name === 'TimeoutError' ? 'timeout' : e?.message || e).slice(0, 200)
        if (e?.name === 'AbortError' || lastErr === 'timeout') {
          return { ok: false, error: 'timeout', reason: 'upstream', browserMs: 0 }
        }
        break // network error on this prefix — try the next one
      }
    }
  }
  return { ok: false, error: 'no_endpoint', reason: 'upstream', detail: lastErr, status: lastStatus }
}

// ── Rendered screenshot (via /snapshot: JSON + base64, shares all the
//    fallback/budget machinery instead of parsing raw image bytes) ─────
export async function browserRunScreenshot(url, creds, opts = {}) {
  const snap = await browserRunSnapshot(url, creds, {
    formats: ['screenshot', 'markdown'],
    screenshotOptions: opts.fullPage ? { fullPage: true } : undefined,
    viewport: opts.viewport,
    timeoutMs: opts.timeoutMs || 45000,
    fetchImpl: opts.fetchImpl,
  })
  if (!snap.ok || !snap.screenshotB64) {
    return { ok: false, error: snap.error || 'no_image', browserMs: snap.browserMs || 0 }
  }
  return { ok: true, b64: snap.screenshotB64, title: snap.title, browserMs: snap.browserMs, markdown: snap.markdown }
}

// ── Read chain: Jina → gate → Browser Run → degrade to Jina ───────────
// Static pages never touch the quota (the gate passes on Jina's text).
// JS shells, bot walls and Jina failures escalate to the rendered
// engine; if that fails too, Jina's imperfect text still beats nothing.
export async function readPageContent(url, opts = {}) {
  const jina = await jinaRead(url, opts.fetchImpl, opts.jinaTimeoutMs || 12000)
  if (jina && !looksLikeJsShell(jina)) {
    return { ok: true, content: jina, source: 'jina' }
  }
  const creds = opts.creds
  const canRender = isBrowserRunConfigured(creds)
  if (canRender && underBudget()) {
    const snap = await browserRunSnapshot(url, creds, {
      formats: ['markdown', 'content'],
      gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
      timeoutMs: opts.renderTimeoutMs || 45000,
      fetchImpl: opts.fetchImpl,
    })
    if (snap.ok && (snap.markdown || snap.content)) {
      return {
        ok: true,
        content: (snap.markdown || stripHtmlToText(snap.content)).slice(0, 15000),
        source: 'browser-run',
        title: snap.title,
        browserMs: snap.browserMs,
      }
    }
  }
  if (jina) return { ok: true, content: jina, source: 'jina', degraded: true }
  return {
    ok: false,
    reason: canRender ? (underBudget() ? 'render_failed' : 'budget_exhausted') : 'not_configured',
  }
}
