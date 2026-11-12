// ════════════════════════════════════════════════════════════════════
// probe_v53018_typography.mjs — typography verification on the real /chat
// page (dev AND prod — AI reply is route-mocked).
//
// RECON=1  → measure + print only (exit 0)
// default  → assert the v5.30.18 typography targets:
//   T1  inline code chip / pre / kbd / .font-mono render JetBrains Mono
//   T2  composer (collapsed input + expanded textarea) renders Inter
//   T3  assistant prose line-height ≥ 1.6 (breathing room)
//   T4  a leading "> …" line in a USER message renders as a styled quote
//       block (blockquote element with a left border), not raw mono text
//   T5  body stays Inter
// ════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const RECON = process.env.RECON === '1'
const SHOT = '/tmp/v53018'
mkdirSync(SHOT, { recursive: true })

const REPLY = [
  'First paragraph of prose so we can measure the vertical rhythm the way a reader actually sees it, with enough words to wrap onto at least two lines on a desktop viewport.',
  '',
  'Check `sandbox_git` inline, the URL https://github.com/appwrite/appwrite, and:',
  '',
  '```bash\nsandbox_git clone https://github.com/appwrite/appwrite\n```',
  '',
  'Closing paragraph for spacing measurements.',
].join('\n')

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ${RECON ? '· INFO' : '✗'} ${label}${extra ? ' — ' + extra : ''}`) }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 120)))

let chatCalls = 0
await page.route('**/api/chat', async (route) => {
  chatCalls++
  await route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: `data: ${JSON.stringify({ type: 'done', reply: REPLY })}\n\n`,
  })
})

await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await page.waitForSelector('input.chat-collapsed-input', { timeout: 120000 })
// settle past hydration BEFORE the first interaction: a pre-hydration click
// focuses the input natively, and a click on an ALREADY-FOCUSED input fires
// no new focus event — React's onFocus never runs and the bar never expands
await page.waitForTimeout(5000)
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })

// expand composer — real CLICK on the collapsed input, blurred first so the
// click actually produces a fresh focus event (see note above)
let ta = null
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => { try { document.activeElement?.blur?.() } catch {} })
  const input = page.locator('input.chat-collapsed-input').first()
  try {
    await input.click({ timeout: 4000 })
  } catch (e) {
    console.log(`  · click attempt ${i} failed: ${String(e).split('\n')[0].slice(0, 140)}`)
  }
  ta = page.locator('textarea').last()
  try { await ta.waitFor({ state: 'visible', timeout: 3000 }); break } catch { ta = null }
}
if (!ta) {
  const diag = await page.evaluate(() => ({
    collapsed: !!document.querySelector('input.chat-collapsed-input'),
    expandedContainer: !!document.querySelector('.chat-container-expanded'),
    textareas: document.querySelectorAll('textarea').length,
    active: document.activeElement?.tagName || null,
    head: document.body.innerText.slice(0, 200).replace(/\n/g, ' | '),
  })).catch(e => ({ evalError: String(e).slice(0, 100) }))
  console.log('EXPANSION DIAG:', JSON.stringify(diag, null, 1))
  console.log('PAGE ERRORS before expansion:', JSON.stringify(errors.slice(0, 5)))
  throw new Error('composer never expanded')
}

// measure the expanded textarea BEFORE sending — send() collapses the bar
// and unmounts the textarea
const taFont = await ta.evaluate(el => getComputedStyle(el).fontFamily)
const taLh = await ta.evaluate(el => getComputedStyle(el).lineHeight)

// send a user message with a leading quote line, get the mocked reply
await ta.fill('> quoting the earlier point\n\nand why exactly?')
await ta.press('Enter')
await page.waitForTimeout(1500)

// CodeBlock mounts collapsed — expand it so the <pre> body exists for T1b
const expandBtn = page.locator('[data-msg-index]').last().locator('[aria-label="Expand code"]')
if (await expandBtn.count()) {
  await expandBtn.click()
  await page.waitForTimeout(300)
}

// ── measure everything ──
const m = await page.evaluate(() => {
  const fam = (el) => el ? getComputedStyle(el).fontFamily : null
  const lh = (el) => el ? getComputedStyle(el).lineHeight : null
  const fs = (el) => el ? getComputedStyle(el).fontSize : null
  const rows = [...document.querySelectorAll('[data-msg-index]')]
  const lastRow = rows[rows.length - 1]
  // the user message (with the leading quote) is the first row — after the
  // v5.30.18 fix its rendered text no longer STARTS with ">" (the marker is
  // stripped into the styled block), so find by position
  const userRow = rows[0]
  const probe = (tag, cls, text) => {
    const el = document.createElement(tag)
    if (cls) el.className = cls
    el.textContent = text
    document.body.appendChild(el)
    const out = { fam: fam(el), lh: lh(el) }
    el.remove()
    return out
  }
  return {
    body: { fam: fam(document.body) },
    collapsedInput: { fam: fam(document.querySelector('input.chat-collapsed-input')) },
    textarea: { fam: '(measured pre-send)', lh: null },
    prose: {
      fam: fam(lastRow?.querySelector('.markdown-body p, [class*="markdown"] p, p')),
      lh: lh(lastRow?.querySelector('.markdown-body p, [class*="markdown"] p, p')),
      fs: fs(lastRow?.querySelector('.markdown-body p, [class*="markdown"] p, p')),
    },
    inlineChip: {
      el: !!lastRow?.querySelector('p code, :not(pre) > code'),
      fam: fam(lastRow?.querySelector('p code, :not(pre) > code')),
    },
    pre: { fam: fam(lastRow?.querySelector('pre')), found: !!lastRow?.querySelector('pre') },
    kbd: probe('kbd', null, 'Enter'),
    fontMono: probe('div', 'font-mono', 'mono probe'),
    userBubble: {
      found: !!userRow,
      innerHTMLHead: userRow ? userRow.innerHTML.slice(0, 220) : '',
      hasBlockquote: userRow ? !!userRow.querySelector('[data-user-quote], blockquote') : false,
      quoteFam: fam(userRow?.querySelector('[data-user-quote]')),
      fam: fam(userRow?.querySelector('span, div:not([class*="rounded"])')),
      lh: lh(userRow?.querySelector('span, div:not([class*="rounded"])')),
    },
    actionCardMono: probe('div', 'font-mono', 'action card probe'),
  }
})

m.textarea = { fam: taFont, lh: taLh } // measured pre-send in Node scope
console.log('── measurements ──')
for (const [k, v] of Object.entries(m)) console.log(`  ${k}: ${JSON.stringify(v)}`)
console.log('── assertions ──')

const isJet = (f) => /jetbrains/i.test(String(f || ''))
const isInter = (f) => /inter/i.test(String(f || '')) && !/jetbrains|mono/i.test(String(f || ''))

ok('T1a inline code chip renders JetBrains', isJet(m.inlineChip.fam), String(m.inlineChip.fam))
ok('T1b pre block renders JetBrains', isJet(m.pre.fam), String(m.pre.fam))
ok('T1c kbd renders JetBrains', isJet(m.kbd.fam), String(m.kbd.fam))
ok('T1d .font-mono renders JetBrains', isJet(m.fontMono.fam), String(m.fontMono.fam))
ok('T2a collapsed composer input renders Inter', isInter(m.collapsedInput.fam), String(m.collapsedInput.fam))
ok('T2b expanded composer textarea renders Inter', isInter(m.textarea.fam), String(m.textarea.fam))
const lhNum = parseFloat(String(m.prose.lh || '0'))
ok('T3 assistant prose line-height ≥ 1.6×', lhNum / parseFloat(String(m.prose.fs || '16')) >= 1.6,
  `lh=${m.prose.lh} fs=${m.prose.fs}`)
ok('T4 user "> …" line renders as a styled quote block', m.userBubble.hasBlockquote,
  m.userBubble.found ? 'found' : 'no user row')
ok('T4b quote block renders Inter (not mono)', isInter(m.userBubble.quoteFam), String(m.userBubble.quoteFam))
ok('T5 body stays Inter', isInter(m.body.fam), String(m.body.fam))

console.log(`PAGE ERRORS: ${errors.length}`, errors.slice(0, 3))
await page.screenshot({ path: SHOT + '/v53018-typography.png', fullPage: false })
console.log(`RESULT: ${pass} passed, ${fail} failed${RECON ? ' (RECON — failures are diagnostics)' : ''}`)
await browser.close()
process.exit(RECON ? 0 : (fail ? 1 : 0))
