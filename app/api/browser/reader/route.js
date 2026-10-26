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
  if (!article || !article.html) {
    return json({ ok: true, title: article?.title || '', html: '', wordCount: article?.wordCount || 0, url: finalUrl })
  }
  return json({ ok: true, title: article.title, html: article.html, wordCount: article.wordCount, url: finalUrl })
}
