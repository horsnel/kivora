// ════════════════════════════════════════════════════════════════════
// probe_v53016.mjs — v5.30.16 visual + functional probe on the real /chat
// page. Works against dev AND production: the AI reply comes from a
// Playwright route-mock (client-side SSE interception), so no API key or
// backend is needed and identical assertions run in both environments.
//
// Covers:
//   A. font-var fix — code/pre/.font-mono resolve real JetBrains Mono
//   B. dynamic header title — appears after first send (first-msg fallback)
//   C. action bar — 6 buttons, layout left/right
//   D. copy → clipboard (stripped markdown)
//   E. quote (no selection) → full message as blockquote in composer
//   F. quote (with selection) → exactly the selection
//   G. thumbs up/down toggle + aria-pressed
//   H. rerun → conversation truncated + mock re-reply replaces the message
//   I. save as guest → sign-in toast (authed save is covered by the VFS suite)
// ════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const SHOT = '/tmp/v53016'
mkdirSync(SHOT, { recursive: true })

const REPLY_1 = 'Hello from **Kivora** v5.30.16. This line exists so you can `select` part of it.'
const REPLY_2 = 'Rerun produced this SECOND version.'

const sse = (reply) =>
  'data: {"type":"delta","v":"partial"}\n\n' +
  `data: {"type":"done","reply":${JSON.stringify(reply)}}\n\n`

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 120)))

// Mock the chat SSE endpoint BEFORE any navigation
let chatCalls = 0
await page.route('**/api/chat', async (route) => {
  chatCalls++
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: sse(chatCalls === 1 ? REPLY_1 : REPLY_2),
  })
})

await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
// Fresh chat renders NO textarea (collapsed bar uses <input>) — don't wait
// for one; wait for the real app shell (the collapsed composer input).
const taReady = await page.waitForSelector('input.chat-collapsed-input', { timeout: 120000 }).then(() => true).catch(() => false)
if (!taReady) {
  const diag = await page.evaluate(() => ({
    url: location.href,
    bodyClasses: document.body.className,
    bodyChars: document.body.innerHTML.length,
    hasRoot: !!document.querySelector('[data-app-scroll] , #app-scroll-container, main'),
    head: document.body.innerText.slice(0, 200),
  }))
  console.log('DIAG:', JSON.stringify(diag, null, 1))
}
await page.waitForTimeout(1500)
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })

// ── A. font-var fix: mono elements resolve JetBrains ──
const font = await page.evaluate(() => {
  const host = document.body
  const mk = (tag, cls) => {
    const el = document.createElement(tag)
    if (cls) el.className = cls
    el.style.position = 'absolute'; el.style.visibility = 'hidden'
    el.textContent = 'mono'
    host.appendChild(el)
    return getComputedStyle(el).fontFamily
  }
  const out = {
    pre: mk('pre'),
    code: mk('code'),
    kbd: mk('kbd'),
    cls: mk('div', 'font-mono'),
    bodyVar: getComputedStyle(document.body).getPropertyValue('--font-mono'),
    bodyFont: getComputedStyle(document.body).fontFamily,
  }
  host.querySelectorAll('pre, code, kbd, .font-mono').forEach(el => {
    if (el.textContent === 'mono') el.remove()
  })
  return out
})
const jet = /jetbrains/i
ok('A1 pre → JetBrains', jet.test(font.pre), font.pre.slice(0, 60))
ok('A2 code → JetBrains', jet.test(font.code), font.code.slice(0, 60))
ok('A3 kbd → JetBrains', jet.test(font.kbd), font.kbd.slice(0, 60))
ok('A4 .font-mono → JetBrains', jet.test(font.cls), font.cls.slice(0, 60))
ok('A5 body --font-mono var non-empty', font.bodyVar.trim().length > 0, font.bodyVar.slice(0, 50))
ok('A6 body still Inter (sans untouched)', /inter/i.test(font.bodyFont), font.bodyFont.slice(0, 60))

// ── B. empty chat: no title ──
ok('B1 no title on fresh chat', await page.locator('[data-chat-title]').count() === 0)

// ── send a message through the real composer ──
// Collapsed bar = <input class="chat-collapsed-input">, focus expands to a
// <textarea>; both bind the same `input` state. Helper picks whichever is live.
const composer = async () => (await page.locator('textarea').count())
  ? page.locator('textarea').last()
  : page.locator('input.chat-collapsed-input')
// Diagnostic: why would the composer be missing/hidden here?
const cd = await page.evaluate(() => {
  const el = document.querySelector('input.chat-collapsed-input')
  if (!el) return { found: false, tail: document.body.innerText.slice(-200).replace(/\n/g, ' | ') }
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return {
    found: true, w: r.width, h: r.height, vis: cs.visibility, disp: cs.display, op: cs.opacity,
    coveredBy: top ? `${top.tagName}.${String(top.className).slice(0, 60)}` : null,
  }
})
console.log('COMPOSER DIAG:', JSON.stringify(cd))
// Direct focus() (bypasses pointer interception) — fires React onFocus →
// setBarExpanded(true) → the expanded bar's textarea mounts.
await page.evaluate(() => document.querySelector('input.chat-collapsed-input')?.focus())
const expanded = page.locator('textarea').last()
await expanded.waitFor({ state: 'visible', timeout: 15000 })
await expanded.fill('Hello mock title test')
await expanded.press('Enter')
await page.waitForTimeout(1200) // stream + finalize

// ── B. title appears (first user message fallback) ──
const title = await page.locator('[data-chat-title]').first().textContent().catch(() => null)
ok('B2 title appears after send', !!title, title || '(none)')
ok('B3 title is the first user msg (≤40 chars)', title && title.includes('Hello mock title test'), title || '')

// ── C. action bar ──
const bar = page.locator('[data-action-bar]').first()
ok('C1 action bar rendered', await bar.count() === 1)
for (const ab of ['copy', 'quote', 'save', 'up', 'down', 'rerun']) {
  ok(`C2 ${ab} button present`, await bar.locator(`[data-ab="${ab}"]`).count() === 1)
}
const layout = await bar.evaluate(el => {
  const groups = [...el.querySelectorAll(':scope > div')]
  const first = groups[0]?.querySelector('button')
  const last = groups[groups.length - 1]?.querySelectorAll('button')
  return {
    groups: groups.length,
    leftFirst: first?.getAttribute('data-ab'),
    rightButtons: last ? [...last].map(b => b.getAttribute('data-ab')) : [],
  }
})
ok('C3 two groups (left actions / right feedback)', layout.groups === 2, JSON.stringify(layout))
ok('C4 left group starts with copy', layout.leftFirst === 'copy')
ok('C5 right group = up/down/rerun', JSON.stringify(layout.rightButtons) === '["up","down","rerun"]')

// ── D. copy → clipboard (markdown stripped) ──
await bar.locator('[data-ab="copy"]').click()
await page.waitForTimeout(300)
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
ok('D1 clipboard has stripped markdown', clip === 'Hello from Kivora v5.30.16. This line exists so you can select part of it.', JSON.stringify(clip.slice(0, 60)))

// ── E. quote without selection → full message as blockquote ──
await bar.locator('[data-ab="quote"]').click()
await page.waitForTimeout(300)
const q1 = await (await composer()).inputValue()
ok('E1 quote prefixes > per line', q1.startsWith('> Hello from Kivora v5.30.16'), JSON.stringify(q1.slice(0, 40)))
await (await composer()).fill('')

// ── F. quote WITH selection → exactly the selection ──
await page.evaluate(() => {
  const bar = document.querySelector('[data-action-bar]')
  const row = bar.closest('[data-msg-index]')
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const idx = node.textContent.indexOf('select')
    if (idx >= 0) {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, Math.min(idx + 6, node.textContent.length)) // exactly "select"
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
  }
})
const selText = await page.evaluate(() => window.getSelection().toString())
ok('F1 selection captured', selText.trim().length > 0, JSON.stringify(selText))
await bar.locator('[data-ab="quote"]').click()
await page.waitForTimeout(300)
const q2 = await (await composer()).inputValue()
ok('F2 quoted text = the selection', q2.includes(selText.trim()), JSON.stringify(q2))
ok('F3 quoted text ≠ full message', !q2.includes('Kivora'), JSON.stringify(q2.slice(0, 60)))
await (await composer()).fill('')

// ── G. thumbs toggle ──
const up = bar.locator('[data-ab="up"]')
const down = bar.locator('[data-ab="down"]')
await up.click(); await page.waitForTimeout(150)
ok('G1 up pressed', (await up.getAttribute('aria-pressed')) === 'true')
await down.click(); await page.waitForTimeout(150)
ok('G2 down pressed releases up', (await down.getAttribute('aria-pressed')) === 'true' && (await up.getAttribute('aria-pressed')) === 'false')
await down.click(); await page.waitForTimeout(150)
ok('G3 second click unpresses', (await down.getAttribute('aria-pressed')) === 'false')

// ── H. rerun ──
ok('H1 one chat call so far', chatCalls === 1, String(chatCalls))
const msgCountBefore = await page.locator('[data-msg-index]').count()
await bar.locator('[data-ab="rerun"]').click()
await page.waitForTimeout(1200)
const lastMsg = await page.evaluate(() => {
  const rows = document.querySelectorAll('[data-msg-index]')
  return rows[rows.length - 1]?.innerText || ''
})
ok('H2 rerun fired a second chat call', chatCalls === 2, String(chatCalls))
ok('H3 message replaced with second reply', lastMsg.includes('SECOND version'), JSON.stringify(lastMsg.slice(0, 80)))
ok('H4 message count unchanged (2)', msgCountBefore === 2 && (await page.locator('[data-msg-index]').count()) === 2)

// ── I. save as guest → sign-in toast ──
await bar.locator('[data-ab="save"]').click()
await page.waitForTimeout(400)
const toast = await page.evaluate(() => document.body.innerText.includes('Sign in to save to your workspace'))
ok('I1 guest save → sign-in toast', toast)

// ── screenshot the bar + title for the visual record ──
await page.evaluate(() => {
  const bar = document.querySelector('[data-action-bar]')
  const title = document.querySelector('[data-chat-title]')
  if (title) title.scrollIntoView({ block: 'start' })
})
await page.waitForTimeout(300)
await page.screenshot({ path: SHOT + '/action-bar.png' })

console.log(`PAGE ERRORS: ${errors.length}`, errors.slice(0, 3))
console.log(`RESULT: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
