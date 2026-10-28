export const runtime = 'edge'

// ══════════════════════════════════════════════════════════════════════
// /api/browser/ask — v5.30.3 Page-aware AI actions
//
// Kivora Browser's toolbar sparkle opens a menu of page-aware actions:
//   summarize — what the page is, key points, notable numbers
//   links     — every meaningful link as a markdown table
//   facts     — prices, dates, names, specs extracted into a table
//   translate — the page's text rendered in the UI language
//
// The route fetches the page server-side (desktop UA, same SSRF wall as
// the proxy via validateTarget), extracts readable text / the link list,
// and runs ONE provider pass: Mistral primary → legacy chain fallback
// (the proven devtools ladder). No tools, no streaming — a single JSON
// answer the browser panel renders as markdown.
//
// Known limit (v1): the fetch is session-less — personalized/logged-in
// page states aren't reflected. The cookie jar lives in the SW and is
// only wired into the proxy path; wiring it here is a follow-up.
// ══════════════════════════════════════════════════════════════════════
import { MODEL, groqChat, GroqError, getPrimaryClientAsync, setGeminiApiKey, setOpenrouterApiKey } from '@/lib/groq'
import { mistralChat, MistralError, setMistralApiKeys } from '@/lib/mistral'
import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit, getClientIP } from '@/lib/ratelimit'
import { consumeFeatureUsage, getFeatureUsage, nextUTCResetISO } from '@/lib/featureUsage'
import { resolveUserAndAdmin } from '@/lib/authUser'
import { validateTarget, extractTitle, extractArticle } from '@/lib/browser/core.mjs'

const FEATURE_ACTION = 'browser_ai'
const TEXT_CAP = 12000 // chars of page text sent to the model
const LINK_CAP = 40

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const TASKS = ['summarize', 'links', 'facts', 'translate']

const SYSTEM = 'You are Kivora Browser\'s page-analysis assistant. You read the text of the web page the user is viewing and answer ONLY from that content — never invent facts the page does not contain. If the page text seems truncated or lacks the answer, say so plainly. Answer in rich markdown: **bold** key terms, tables for structured data, short bullets. Be concise and specific; no filler, no "sure, here is…" preambles.'

function taskPrompt(task, lang) {
  switch (task) {
    case 'links':
      return 'List the meaningful links on this page as a markdown table with columns | Link | URL |. Skip navigation repeats, social-media icon rows and empty anchors. Sort in page order. Max 40 rows.'
    case 'facts':
      return 'Extract every concrete fact on this page — prices (with currency), dates, names, quantities, ratings, specifications — into one compact markdown table: | Item | Value | Context |. Include a one-line "What this page is" sentence above the table.'
    case 'translate':
      return `Translate the page's main text content into ${lang || 'English'}. Preserve structure with markdown headings and paragraphs. Do not summarize — translate the substance; you may skip repeated boilerplate (nav bars, cookie banners, footers).`
    case 'summarize':
    default:
      return 'Summarize this page: 1) one sentence on what the page is, 2) 3-6 key points as bullets, 3) any notable numbers/prices/dates, 4) who the page is for or what action it invites. Keep it tight.'
  }
}

// raw HTML → plain text for the model
// NOTE: extractArticle returns { title, html, wordCount } — use its
// `html` field when substantial, else fall back to the full document.
function htmlToText(html) {
  let article = html
  try {
    const art = extractArticle(html, 'https://page.local/')
    if (art && typeof art.html === 'string' && art.html.length > 40) article = art.html
  } catch {}
  return article
    .replace(/<(script|style|noscript|svg|template|iframe|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, TEXT_CAP)
}

// raw HTML → absolute link list for the `links` task
function extractLinks(html, baseHref) {
  const out = []
  const seen = new Set()
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html)) && out.length < LINK_CAP * 2) {
    const rawHref = m[1].trim()
    if (!rawHref || /^(javascript|mailto|tel):/i.test(rawHref)) continue
    let abs
    try { abs = new URL(rawHref, baseHref).href } catch { continue }
    if (seen.has(abs)) continue
    seen.add(abs)
    const label = m[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90)
    if (!label) continue
    out.push({ label, href: abs })
    if (out.length >= LINK_CAP) break
  }
  return out
}

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    // ── providers (same warm-up order as the devtools route) ──
    const mistralKey = await getEnvVar('MISTRAL_API_KEY')
    const mistralFallbackKey = await getEnvVar('MISTRAL_API_KEY_FALLBACK')
    setMistralApiKeys(mistralKey, mistralFallbackKey)
    const geminiKey = await getEnvVar('GEMINI_API_KEY')
    setGeminiApiKey(geminiKey)
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')
    setOpenrouterApiKey(openrouterKey)
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const groqClient = await getPrimaryClientAsync(groqKey)

    const { url, task = 'summarize', lang } = await req.json().catch(() => ({}))

    // ── SSRF wall — identical rules to the browsing proxy ──
    const v = validateTarget(typeof url === 'string' ? url : '')
    if (!v.ok) return Response.json({ error: 'Invalid or blocked URL.' }, { status: 400 })
    if (!TASKS.includes(task)) return Response.json({ error: `Unknown task: ${task}` }, { status: 400 })

    // ── tiered usage (same meter family as DevTools) ──
    const { user, admin } = await resolveUserAndAdmin(req)
    const usage = await consumeFeatureUsage(admin, user?.id, ip, FEATURE_ACTION)
    if (!usage.ok) {
      return Response.json({
        error: `You've used all ${usage.limit} free page actions for today. Your allowance resets at 00:00 UTC.`,
        reason: 'daily_limit_reached',
        used: usage.used, limit: usage.limit, remaining: 0, reset_at: usage.reset_at, tier: usage.tier,
        upgrade_url: '/pricing',
      }, { status: 429 })
    }

    // ── fetch the page (single hop, direct fetch) ──
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    let html
    try {
      const res = await fetch(v.url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': `${lang || 'en'};q=0.9,en;q=0.6` },
      })
      if (!res.ok) {
        return Response.json({ error: `The site responded with HTTP ${res.status} — this page can't be read right now.` }, { status: 502 })
      }
      const ct = res.headers.get('content-type') || ''
      if (!/text\/html|application\/xhtml/i.test(ct)) {
        return Response.json({ error: 'This URL is not an HTML page, so page actions can\'t read it.' }, { status: 415 })
      }
      html = await res.text()
    } catch (e) {
      return Response.json({ error: e?.name === 'AbortError' ? 'The site took too long to respond.' : 'Could not reach the site.' }, { status: 504 })
    } finally {
      clearTimeout(timer)
    }

    // ── build the model input ──
    const title = extractTitle(html) || ''
    let pageBlock
    if (task === 'links') {
      const links = extractLinks(html, v.url)
      if (!links.length) return Response.json({ error: 'No readable links were found on this page.' }, { status: 422 })
      pageBlock = `Page title: ${title}\nPage URL: ${v.url}\n\nLinks on the page:\n${links.map((l) => `- [${l.label}](${l.href})`).join('\n')}`
    } else {
      const text = htmlToText(html)
      if (text.length < 80) {
        return Response.json({ error: 'Couldn\'t extract readable text — the page is likely JavaScript-rendered. Try the page\'s reader mode instead.' }, { status: 422 })
      }
      pageBlock = `Page title: ${title}\nPage URL: ${v.url}\n\nPage text:\n"""\n${text}\n"""`
    }

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `${taskPrompt(task, lang)}\n\n${pageBlock}` },
    ]

    // ── one provider pass: Mistral primary → legacy chain fallback ──
    let chat
    let provider = 'mistral'
    try {
      chat = await mistralChat({ messages })
    } catch (mistralErr) {
      console.warn('[browser-ask] Mistral unavailable, falling back:', mistralErr?.message)
      if (!groqClient) {
        return Response.json({ error: 'AI service not configured' }, { status: 503 })
      }
      provider = 'fallback'
      chat = await groqChat({ model: MODEL, messages })
    }

    return Response.json({
      result: chat.choices[0]?.message?.content || '',
      provider,
      title,
      url: v.url,
      task,
      usage,
    })
  } catch (err) {
    console.error('[browser-ask]', err)
    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({ error: 'Too many requests, try again later.', quotaExceeded: true }, { status: 429 })
    }
    if (err instanceof MistralError) {
      return Response.json({ error: 'AI service unavailable, try again shortly.' }, { status: 503 })
    }
    return Response.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

// ── GET — usage snapshot for the panel's allowance hint ──
export async function GET(req) {
  try {
    const ip = getClientIP(req)
    const { user, admin } = await resolveUserAndAdmin(req)
    return Response.json(await getFeatureUsage(admin, user?.id, ip, FEATURE_ACTION))
  } catch {
    return Response.json({ tier: 'anonymous', plan: null, used: 0, limit: 5, remaining: 5, unlimited: false, reset_at: nextUTCResetISO() })
  }
}
