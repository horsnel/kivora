// ════════════════════════════════════════════════════════════════════
// GET /api/browser/reader — Kivora Browser reader mode (v5.24.6)
//
// Server-side readability: fetches a public page, strips scripts/nav/
// footer chrome, picks the best container and returns sanitized,
// absolutely-linked HTML the client renders in a clean typographic pane.
//
// Modes:
//   ?url=X            → { ok, title, html, wordCount, url }
//   ?url=X&meta=1     → { ok, title }          (cheap tab-title lookup)
//
// Same SSRF wall as the proxy (shared core.mjs), same 15s budget.
// runtime=edge is MANDATORY for next-on-pages (v5.22 lesson).
// ════════════════════════════════════════════════════════════════════
import { validateTarget, extractArticle, extractTitle } from '@/lib/browser/core.mjs'
// v5.30.30 — kitesurf escalation: SPA shells / bot walls come back from
// the raw fetch as empty framework mounts. When Browser Run credentials
// exist and the day budget has room, the page is re-fetched through the
// rendered engine (post-JS DOM) and the richer article wins.
import { looksLikeJsShell, browserRunSnapshot, underBudget, stripScriptsForSnapshot } from '@/lib/browser/render.mjs'
import { getEnvVar } from '@/lib/cfEnv'

export const runtime = 'edge'

const FETCH_TIMEOUT = 15000
const TEXT_CAP = 3 * 1024 * 1024

function json(obj, status = 200) {
  return Response.json(obj, { status, headers: { 'cache-control': 'no-store, max-age=0' } })
}

export async function GET(req) {
  const u = new URL(req.url)
  const metaOnly = u.searchParams.get('meta') === '1'
  const v = validateTarget(u.searchParams.get('url') || '')
  if (!v.ok) return json({ ok: false, reason: v.reason }, 403)
  const target = v.url

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT)
  let res
  try {
    res = await fetch(target, {
      headers: {
        // Desktop UA: many news sites serve reader-friendly markup to desktop
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: ac.signal,
    })
  } catch {
    clearTimeout(timer)
    return json({ ok: false, reason: ac.signal.aborted ? 'timeout' : 'network_error' }, 502)
  }
  clearTimeout(timer)

  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (!ct.includes('html') && !ct.includes('xml') && !ct.includes('text/')) {
    return json({ ok: false, reason: 'not_html' }, 415)
  }

  const buf = await res.arrayBuffer()
  if (buf.byteLength > TEXT_CAP) return json({ ok: false, reason: 'too_large' }, 502)
  const charsetMatch = /charset=([\w-]+)/i.exec(ct)
  let html
  try {
    html = new TextDecoder(charsetMatch ? charsetMatch[1] : 'utf-8').decode(buf)
  } catch {
    html = new TextDecoder('utf-8').decode(buf)
  }

  const finalUrl = res.url || target
  if (metaOnly) return json({ ok: true, title: extractTitle(html), url: finalUrl })

  const article = extractArticle(html, finalUrl)
  const rawIsShell = looksLikeJsShell(html)
  const rawWeak = !article?.html || (article?.wordCount || 0) < 40

  // ── v5.30.30 — kitesurf escalation ──
  // Empty/weak article or a JS shell from the raw fetch: re-fetch through
  // Cloudflare Browser Run (kitesurf engine) and keep whichever article is
  // richer. Falls through silently when credentials are missing, the day
  // budget is spent, or the render fails — the raw result is still served.
  if ((rawWeak || rawIsShell) && !metaOnly) {
    try {
      const [apiToken, accountId] = await Promise.all([getEnvVar('CF_API_TOKEN'), getEnvVar('CF_ACCOUNT_ID')])
      if (apiToken && accountId && underBudget()) {
        const snap = await browserRunSnapshot(finalUrl, { apiToken, accountId }, {
          formats: ['content', 'markdown'],
          gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
          timeoutMs: 40000,
        })
        if (snap.ok && snap.content) {
          const rendered = extractArticle(stripScriptsForSnapshot(snap.content), finalUrl)
          const rawWords = article?.wordCount || 0
          if (rendered?.html && (rendered.wordCount || 0) > rawWords) {
            return json({
              ok: true,
              title: rendered.title || snap.title || article?.title || '',
              html: rendered.html,
              wordCount: rendered.wordCount,
              url: finalUrl,
              rendered: true,
            })
          }
        }
      }
    } catch {}
  }

  if (!article || !article.html) {
    return json({ ok: true, title: article?.title || '', html: '', wordCount: article?.wordCount || 0, url: finalUrl, jsShell: rawIsShell })
  }
  return json({ ok: true, title: article.title, html: article.html, wordCount: article.wordCount, url: finalUrl })
}
