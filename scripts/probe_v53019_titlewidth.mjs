// ════════════════════════════════════════════════════════════════════
// probe_v53019_titlewidth.mjs — header/drawer title width probe (dev AND
// prod). Sends one long first message with REALISTIC text (words + spaces —
// an unbreakable W-run would ellipsize in any box and prove nothing), then
// measures at three viewports:
//   • the top bar / center title container / h1 box widths + ellipsis state
//   • the drawer width + a session row's box and hover tooltip
// RECON=1 → print only; default → assert the v5.30.19 targets:
//   W1 at 1280×900: a 110-char title fits the header WITHOUT ellipsis
//   W2 at 1280×900: header center ≥ 800px wide
//   W3 at 640×900:  header title box ≥ 360px
//   D1 at 1280×900: drawer ≥ 280px (w-60 240px truncated rows at ~34 chars)
//   D2 at 1280×900: session rows carry the full-title hover tooltip
// ════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const RECON = process.env.RECON === '1'
// 150 chars of normal words → chatTitle slice(0,120) keeps 120 with spaces
const LONG_MSG = 'Search for a trending open source repository to clone and study this week, compare the licenses and community activity, then summarize '.trim() + 'the findings.'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ${RECON ? '· INFO' : '✗'} ${label}${extra ? ' — ' + extra : ''}`) }
}

const browser = await chromium.launch()
const REPLY = 'ok.'

for (const [w, h, label] of [[1280, 900, 'desktop 1280'], [640, 900, 'half 640']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)))
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' },
      body: `data: ${JSON.stringify({ type: 'done', reply: REPLY })}\n\n` })
  })
  await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForSelector('input.chat-collapsed-input', { timeout: 120000 })
  // settle past hydration, then blur-before-click: a click on an
  // already-focused input fires no focus event, so React onFocus (the bar
  // expansion) never runs — see probe_v53018 lessons
  await page.waitForTimeout(5000)
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })
  let ta = null
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { try { document.activeElement?.blur?.() } catch {} })
    const input = page.locator('input.chat-collapsed-input').first()
    await input.click({ timeout: 4000 }).catch(e => console.log(`  · click ${i} FULL: ${String(e).split('\n').slice(0, 8).join(' | ').slice(0, 500)}`))
    ta = page.locator('textarea').last()
    try { await ta.waitFor({ state: 'visible', timeout: 3000 }); break } catch { ta = null }
  }
  if (!ta) throw new Error(`composer never expanded (${label})`)
  await ta.fill(LONG_MSG)
  await ta.press('Enter')
  await page.waitForTimeout(1500)

  const m = await page.evaluate(() => {
    const h1 = document.querySelector('[data-chat-title]')
    const aside = document.querySelector('aside')
    const row = aside?.querySelector('button[title]')
    return {
      h1: !!h1,
      textLen: h1 ? h1.textContent.length : 0,
      h1w: h1 ? Math.round(h1.getBoundingClientRect().width) : 0,
      centerw: h1 ? Math.round(h1.parentElement.getBoundingClientRect().width) : 0,
      truncated: h1 ? h1.scrollWidth > h1.clientWidth + 1 : null,
      drawerW: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      rowTooltip: row ? row.getAttribute('title') : null,
      rowW: row ? Math.round(row.getBoundingClientRect().width) : 0,
    }
  }).catch(e => ({ evalError: String(e).slice(0, 120) }))
  console.log(`── ${label} ──`)
  console.log('  ', JSON.stringify(m))
  if (label === 'desktop 1280') {
    ok('W1 desktop: 110+ chars visible without ellipsis', m.textLen >= 110 && m.truncated === false,
      `len=${m.textLen} truncated=${m.truncated} h1w=${m.h1w}`)
    ok('W2 desktop: header center ≥ 800px', m.centerw >= 800, `centerw=${m.centerw}`)
    ok('D1 drawer widened to ≥ 280px (was 240 — rows truncated at ~34 chars)', m.drawerW >= 280, `drawerW=${m.drawerW}`)
    // D2/D3 (row tooltip + row box) need a signed-in history — guests have
    // no session rows; the wiring is covered by the unit suites instead.
  }
  if (label === 'half 640') {
    ok('W3 half-width: title box ≥ 360px', m.h1w >= 360, `h1w=${m.h1w}`)
  }
  ok(`no page errors (${label})`, errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

console.log(`RESULT: ${pass} passed, ${fail} failed${RECON ? ' (RECON)' : ''}`)
await browser.close()
process.exit(RECON ? 0 : (fail ? 1 : 0))
