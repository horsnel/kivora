// ════════════════════════════════════════════════════════════════════
// probe_v53017.mjs — v5.30.17 visual + functional probe on the real /chat
// page (dev AND prod — the AI reply is route-mocked, no backend needed).
//
// Covers:
//   A. duplicate-bar fix — a mid-stream failure ("stopped progressing")
//      renders the error notice card with NO action bar underneath
//   B. tap reliability — every bar button responds to a touch TAP; a slow
//      press (650ms, would-be long-press) opens no bubble card and the
//      click still lands; hit-area pseudo present
//   C. header title width — first message longer than 80 chars → title is
//      exactly 80 (was 40, read as "truncating too early")
//   D. quote → @-mention chip — chip appears (excerpt = selection when one
//      exists), dismissible; on send the outgoing message carries the
//      "> @Kivora: …" context block; chip clears after send
//   E. self-heal — a reply with an unclosed fence renders as a proper code
//      block (no literal ``` text painting the bubble as code)
//   F. thumbs persistence — toggling writes the per-session feedback map to
//      the localStorage mirror (DB write runs for signed-in users)
//   G. rerun regression — still truncates and regenerates
// ════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const SHOT = '/tmp/v53017'
mkdirSync(SHOT, { recursive: true })

const REPLY_1 = 'Reply one. You can **select** the word selectable here.'
const REPLY_2 = 'Reply two after the mention.'
const FAIL_MSG = 'The response stopped progressing. Please resend your message to try again.'
const REPLY_4 = 'Intro line:\n```js\nconsole.log("unclosed"'
const REPLY_RERUN = 'Reply six AFTER rerun.'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 120)))

// Mock SSE. Replies come from a queue (index 2 = the mid-stream failure);
// the request body is captured so the @-mention context can be asserted.
const bodies = []
const replies = [REPLY_1, REPLY_2, null, REPLY_4, REPLY_RERUN]
let call = 0
await page.route('**/api/chat', async (route) => {
  bodies.push(route.request().postData() || '')
  const reply = call < replies.length ? replies[call] : REPLY_RERUN
  call++
  const payload = reply === null
    ? { type: 'done', error: FAIL_MSG }
    : { type: 'done', reply }
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: `data: ${JSON.stringify(payload)}\n\n`,
  })
})

await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await page.waitForSelector('input.chat-collapsed-input', { timeout: 120000 })
await page.waitForTimeout(1500)
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })

const composer = async () => (await page.locator('textarea').count())
  ? page.locator('textarea').last()
  : page.locator('input.chat-collapsed-input')
const expandComposer = async () => {
  // Hydration latency varies on dev cold starts — retry the focus-driven
  // expansion instead of racing a single attempt against first compile.
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => document.querySelector('input.chat-collapsed-input')?.focus())
    const ta = page.locator('textarea').last()
    try {
      await ta.waitFor({ state: 'visible', timeout: 3000 })
      return ta
    } catch { /* not hydrated yet — retry */ }
  }
  throw Object.assign(new Error('composer never expanded (hydration?)'), {
    diag: await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-msg-index]').length
      const collapsed = document.querySelector('input.chat-collapsed-input')
      const expanded = document.querySelector('.chat-container-expanded')
      return {
        msgRows: rows,
        hasCollapsed: !!collapsed,
        hasExpanded: !!expanded,
        textareaCount: document.querySelectorAll('textarea').length,
        head: document.body.innerText.slice(0, 300).replace(/\n/g, ' | '),
        reactProps: collapsed ? String(Object.keys(collapsed).filter(k => k.startsWith('__react'))[0] || 'none') : 'n/a',
      }
    }),
  })
}
const lastRowText = () => page.evaluate(() => {
  const rows = document.querySelectorAll('[data-msg-index]')
  return rows[rows.length - 1]?.innerText || ''
})
const lastRowHasBar = () => page.evaluate(() => {
  const rows = document.querySelectorAll('[data-msg-index]')
  return !!rows[rows.length - 1]?.querySelector('[data-action-bar]')
})
const send = async (text) => {
  const ta = await expandComposer()
  await ta.fill(text)
  await ta.press('Enter')
  await page.waitForTimeout(1200) // stream + finalize
}

// ── C. header title width (first send, long message) ──
await send('C'.repeat(120) + ' — a long opening question that used to truncate at forty characters')
const title = await page.locator('[data-chat-title]').first().textContent().catch(() => null)
ok('C1 title renders', !!title)
ok('C2 title derives 80 chars (was 40)', title && title.length === 80, `len=${title ? title.length : 0}`)
ok('C3 title content matches slice', title === 'C'.repeat(80))

// ── bar on reply one ──
const bar = page.locator('[data-action-bar]').first()
ok('B1 action bar rendered for reply one', await bar.count() === 1)
for (const ab of ['copy', 'quote', 'save', 'up', 'down', 'rerun']) {
  ok(`B2 ${ab} present`, await bar.locator(`[data-ab="${ab}"]`).count() === 1)
}
const hit = await bar.locator('[data-ab="copy"]').evaluate(el => {
  const st = getComputedStyle(el, '::before')
  return { pos: st.position, inset: st.top, ta: getComputedStyle(el).touchAction }
})
ok('B3 hit-area pseudo mounted', hit.pos === 'absolute' && parseFloat(hit.inset) < 0, JSON.stringify(hit))
ok('B4 touch-action manipulation', hit.ta === 'manipulation', hit.ta)

// ── B. TAP each interactive button (touch) ──
await bar.scrollIntoViewIfNeeded()
// thumbs: tap up → pressed
await bar.locator('[data-ab="up"]').tap()
await page.waitForTimeout(200)
ok('B5 tap up → aria-pressed', (await bar.locator('[data-ab="up"]').getAttribute('aria-pressed')) === 'true')
const metaRaw = await page.evaluate(() => localStorage.getItem('kivora:chat-session-meta') || '')
ok('B6 feedback map mirrored to localStorage', metaRaw.includes('"feedback"') && metaRaw.includes('"1":"up"'),
  metaRaw.slice(-80))
// copy: tap → clipboard
await bar.locator('[data-ab="copy"]').tap()
await page.waitForTimeout(300)
const clip1 = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
ok('B7 tap copy → stripped clipboard', clip1 === 'Reply one. You can select the word selectable here.',
  JSON.stringify(clip1.slice(0, 40)))

// ── B. slow press on a bar button must NOT open the bubble card, and the
//      click must still land (pointerdown isolation) ──
const copyBtn = await bar.locator('[data-ab="copy"]').boundingBox()
await page.mouse.move(copyBtn.x + copyBtn.width / 2, copyBtn.y + copyBtn.height / 2)
await page.mouse.down()
await page.waitForTimeout(650) // long-press threshold is 450ms
const cardDuringHold = await page.locator('#bubble-action-card').count()
await page.mouse.up()
await page.waitForTimeout(400)
const cardAfter = await page.locator('#bubble-action-card').count()
ok('B8 long press opens NO bubble card (was the tap-killer)', cardDuringHold === 0 && cardAfter === 0,
  `during=${cardDuringHold} after=${cardAfter}`)
const clip2 = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
ok('B9 click still lands after slow press', clip2 === clip1)

// quick tap on the bubble TEXT must still open the action card (regression)
const row = page.locator('[data-msg-index]').nth(1)
const rb = await row.boundingBox()
await page.mouse.move(rb.x + rb.width / 2, Math.min(rb.y + 20, rb.y + rb.height - 10))
await page.mouse.down()
await page.waitForTimeout(600)
const cardOnBubble = await page.locator('#bubble-action-card').count()
await page.mouse.up()
await page.waitForTimeout(300)
ok('B10 bubble long-press card still works outside the bar', cardOnBubble === 1)
await page.keyboard.press('Escape')
await page.evaluate(() => { document.dispatchEvent(new Event('click', { bubbles: true })) })
await page.waitForTimeout(200)

// ── D. quote → @-mention chip (no selection → full message excerpt) ──
await bar.locator('[data-ab="quote"]').tap()
await page.waitForTimeout(300)
ok('D1 chip appears', await page.locator('[data-reply-chip]').count() === 1)
const chipText = await page.locator('[data-reply-chip]').innerText()
ok('D2 chip names @Kivora', chipText.includes('@Kivora'), JSON.stringify(chipText.slice(0, 60)))
ok('D3 chip shows the "Replying to" label', chipText.toLowerCase().includes('replying'), chipText.slice(0, 40))
ok('D4 chip excerpt = stripped message', chipText.includes('Reply one'), chipText.slice(0, 60))
// composer untouched by quote now (chip carries the reference)
{
  const val = await (await composer()).inputValue()
  ok('D5 composer input stays empty (chip carries the quote)', val === '', JSON.stringify(val))
}
// dismiss via × — a REAL pointer click must work on its own. (Historic bug:
// with an empty input, mousedown outside chatBarRef collapsed the bar
// mid-tap and the click never landed; the auto-collapse guard now exempts
// the chip.) The diagnostics below only print if the first click failed.
await page.locator('[data-reply-chip] button').last().click()
await page.waitForTimeout(200)
const chipAfterRealClick = await page.locator('[data-reply-chip]').count()
ok('D6 × dismisses the chip on a real tap', chipAfterRealClick === 0)
if (chipAfterRealClick !== 0) {
  const diag = await page.evaluate(() => {
    const btn = document.querySelector('[data-reply-chip] button')
    if (!btn) return { chip: false }
    const r = btn.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    btn.click()
    return {
      chip: true,
      coveredBy: top ? `${top.tagName}.${String(top.className).slice(0, 50)}` : null,
      onTop: top === btn || btn.contains(top),
    }
  })
  console.log('D6 DIAG:', JSON.stringify(diag))
  await page.waitForTimeout(200)
}

// ── D. quote WITH selection → excerpt = the selection ──
await page.evaluate(() => {
  const rows = document.querySelectorAll('[data-msg-index]')
  const row = rows[1]
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const idx = node.textContent.indexOf('selectable')
    if (idx >= 0) {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + 10)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
  }
})
ok('D7 selection captured', (await page.evaluate(() => window.getSelection().toString())) === 'selectable')
await bar.locator('[data-ab="quote"]').tap()
await page.waitForTimeout(300)
const chip2 = await page.locator('[data-reply-chip]').innerText()
ok('D8 chip excerpt = exact selection', chip2.includes('“selectable”'), JSON.stringify(chip2.slice(0, 80)))

// ── D. send with the chip → context rides on the wire ──
const ta2 = await expandComposer()
await ta2.fill('and why exactly?')
await ta2.press('Enter')
await page.waitForTimeout(1200)
const lastBody = bodies[bodies.length - 1]
ok('D9 chat call fired with chip active', bodies.length === 2, `calls=${bodies.length}`)
let mentionOk = false, mentionCtx = ''
try {
  const parsed = JSON.parse(lastBody)
  const lastMsg = parsed.messages[parsed.messages.length - 1]
  mentionCtx = String(lastMsg?.content || '')
  mentionOk = mentionCtx.startsWith('> @Kivora: "selectable"') && mentionCtx.includes('and why exactly?')
} catch { mentionOk = false }
ok('D10 outgoing message carries > @Kivora: "…" context', mentionOk, JSON.stringify(mentionCtx.slice(0, 60)))
ok('D11 chip cleared after send', await page.locator('[data-reply-chip]').count() === 0)

// ── A. mid-stream failure → error card, NO action bar ──
const barsBefore = await page.locator('[data-action-bar]').count()
await send('make me fail')
const errText = await lastRowText()
ok('A1 failure renders the error notice card', errText.includes('Something went wrong'), JSON.stringify(errText.slice(0, 60)))
ok('A2 failure notice hides the verbatim stall text (designed card copy)',
  !errText.includes('stopped progressing'))
ok('A3 error card offers Try again', errText.includes('Try again'))
ok('A4 NO action bar under the error message (the reported bug)', !(await lastRowHasBar()))
ok('A5 bar count unchanged', (await page.locator('[data-action-bar]').count()) === barsBefore, `before=${barsBefore}`)

// ── E. self-heal: unclosed fence renders as a code block ──
await send('unclosed please')
const healText = await lastRowText()
const healHasPre = await page.evaluate(() => {
  const rows = document.querySelectorAll('[data-msg-index]')
  return !!rows[rows.length - 1]?.querySelector('pre')
})
ok('E1 unclosed fence parsed into a code block (JavaScript label)', healText.includes('JavaScript'), JSON.stringify(healText.slice(0, 60)))
ok('E2 no literal ``` painted into the bubble', !healText.includes('```'))
// CodeBlock mounts collapsed — expand it, then the <pre> body must exist
await page.locator('[data-msg-index]').last().locator('[aria-label="Expand code"]').click()
await page.waitForTimeout(300)
const healHasPre2 = await page.evaluate(() => {
  const rows = document.querySelectorAll('[data-msg-index]')
  return !!rows[rows.length - 1]?.querySelector('pre')
})
ok('E3 code block element present after expanding', healHasPre2)
ok('E4 bar still renders for the healed reply', await lastRowHasBar())

// ── G. rerun regression ──
const callsBeforeRerun = bodies.length
const lastBar = page.locator('[data-action-bar]').last()
await lastBar.scrollIntoViewIfNeeded()
await lastBar.locator('[data-ab="rerun"]').tap()
await page.waitForTimeout(1200)
ok('G1 rerun fired a new chat call', bodies.length === callsBeforeRerun + 1)
ok('G2 rerun replaced the reply', (await lastRowText()).includes('AFTER rerun'))

// ── screenshot: title + bars + healed code block + error card ──
await page.evaluate(() => {
  const t = document.querySelector('[data-chat-title]')
  if (t) t.scrollIntoView({ block: 'start' })
})
await page.waitForTimeout(300)
await page.screenshot({ path: SHOT + '/v53017-final.png', fullPage: false })

console.log(`PAGE ERRORS: ${errors.length}`, errors.slice(0, 3))
console.log(`RESULT: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
