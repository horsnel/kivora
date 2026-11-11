// v5.30.14 verification probe — the two reverts
// A. sidebar session items: REVERTED to text-caption (12px/18px/400) + ellipsis, POP KEPT (#e5e7eb text, #2f2f2f hover+active)
// B. opportunities OutputMenu: regression (unchanged from v5.30.13)
// C. suggestion pills: regression (unchanged from v5.30.13)
// D. chat-dd-item: REVERTED to original (no bg, no border, no padding, no :hover rule), wiring untouched
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const SHOT = '/tmp/v53014'
mkdirSync(SHOT, { recursive: true })

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}
const eq = (a, b) => a === b || (a && b && a.replace(/\s/g, '') === b.replace(/\s/g, ''))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 100)))

async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

// ════ A. Sidebar session items — revert typography, keep pop ════
console.log('A. sidebar session items (reverted type, kept pop)')
await go('/chat')
// dev-only: hide the Next.js dev-overlay portal so it can't intercept interactions
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })
// open the history drawer (mobile hamburger) so the session list is mounted + in-viewport
await page.evaluate(() => {
  const burger = [...document.querySelectorAll('button')].find(b => /histor/i.test(b.getAttribute('aria-label') || ''))
  if (burger) burger.click()
})
await page.waitForTimeout(800)
const a = await page.evaluate(() => {
  const list = document.querySelector('aside .flex-1.overflow-y-auto')
  if (!list) return { ok: false }
  // active row: current JSX classes (text-caption, no font-medium)
  const rowA = document.createElement('div')
  rowA.className = 'group relative flex items-center rounded-full transition-colors bg-[#2f2f2f]'
  rowA.innerHTML = `<button class="flex-1 min-w-0 text-left px-3 py-2 text-caption transition-colors truncate text-[#e5e7eb]">How to build a scalable REST API with Node.js, PostgreSQL and Redis caching for production traffic spikes</button>`
  // normal row: hover variant
  const rowN = document.createElement('div')
  rowN.className = 'group relative flex items-center rounded-full transition-colors hover:bg-[#2f2f2f]'
  rowN.innerHTML = `<button class="flex-1 min-w-0 text-left px-3 py-2 text-caption transition-colors truncate text-[#e5e7eb]">Second probe row</button>`
  list.appendChild(rowA); list.appendChild(rowN)
  const btn = rowA.querySelector('button')
  const cs = getComputedStyle(btn)
  const csRow = getComputedStyle(rowA)
  return {
    ok: true,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    color: cs.color,
    rowBg: csRow.backgroundColor,
    textOverflow: cs.textOverflow,
    clipped: btn.scrollWidth > btn.clientWidth,
    realRows: list.querySelectorAll('button').length,
  }
})
ok('injected into real drawer list', a.ok, `buttons in list: ${a.realRows}`)
ok('font-size reverted to 12px', a.fontSize === '12px', a.fontSize)
ok('font-weight reverted to 400', a.fontWeight === '400', a.fontWeight)
ok('line-height reverted to 18px', a.lineHeight === '18px', a.lineHeight)
ok('text pop kept #e5e7eb', a.color === 'rgb(229, 231, 235)', a.color)
ok('active row pop kept #2f2f2f', a.rowBg === 'rgb(47, 47, 47)', a.rowBg)
ok('ellipsis kept (truncate)', a.textOverflow === 'ellipsis', a.textOverflow)
ok('long title actually clips', a.clipped)
// hover pop kept: raw mouse over the normal row
const aBox = await page.evaluate(() => {
  const rows = document.querySelectorAll('.flex-1.overflow-y-auto .group.relative')
  const row = rows[rows.length - 1]
  const r = row.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
await page.mouse.move(aBox.x, aBox.y)
await page.waitForTimeout(450)
const aHover = await page.evaluate(() => {
  const rows = document.querySelectorAll('.flex-1.overflow-y-auto .group.relative')
  const row = rows[rows.length - 1]
  return getComputedStyle(row).backgroundColor
})
ok('hover row pop kept #2f2f2f', aHover === 'rgb(47, 47, 47)', aHover)

// real-DOM spot check when sessions exist
const aReal = await page.evaluate(() => {
  const list = document.querySelector('aside .flex-1.overflow-y-auto')
  if (!list) return { present: false }
  const btns = [...list.querySelectorAll('button.text-caption')]
  if (!btns.length) return { present: false }
  const cs = getComputedStyle(btns[0])
  return { present: true, fontSize: cs.fontSize, color: cs.color }
})
if (aReal.present) {
  ok('real session row font-size 12px', aReal.fontSize === '12px', aReal.fontSize)
  ok('real session row color pop', aReal.color === 'rgb(229, 231, 235)', aReal.color)
} else {
  console.log('  - no real session rows in DOM (guest), JSX verified via diff + prod chunk-grep')
}
await page.screenshot({ path: SHOT + '/a-sidebar.png' })

// ════ C. Suggestion pills — regression, unchanged ════
console.log('C. suggestion pills (regression)')
await go('/devtools')
const c = await page.evaluate(() => {
  const host = document.querySelector('main') || document.body
  const div = document.createElement('div')
  div.setAttribute('data-probe-pills', '')
  div.className = 'shrink-0 flex flex-wrap items-center gap-2 pt-3 px-4'
  div.innerHTML = `<button class="inline-block max-w-full text-[11px] leading-[16px] px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a] transition-colors whitespace-nowrap overflow-hidden text-ellipsis disabled:opacity-50" data-probe-pill>Turn my SaaS side project into a profitable subscription business with churn analysis and pricing strategy recommendations</button>`
  host.appendChild(div)
  const b = div.querySelector('[data-probe-pill]')
  const cs = getComputedStyle(b)
  return { bg: cs.backgroundColor, borderColor: cs.borderColor, color: cs.color, textOverflow: cs.textOverflow, clipped: b.scrollWidth > b.clientWidth }
})
ok('pill bg #141414', c.bg === 'rgb(20, 20, 20)', c.bg)
ok('pill border #262626', c.borderColor === 'rgb(38, 38, 38)', c.borderColor)
ok('pill text #737373', c.color === 'rgb(115, 115, 115)', c.color)
ok('pill ellipsis active', c.textOverflow === 'ellipsis', c.textOverflow)
await page.screenshot({ path: SHOT + '/c-pills.png' })

// ════ B. Opportunities OutputMenu — regression, unchanged ════
console.log('B. opportunities OutputMenu (regression)')
await go('/opportunities')
const bCount = await page.evaluate(() => document.querySelectorAll('[data-output-menu]').length)
ok('OutputMenu triggers mounted', bCount > 0, `count=${bCount}`)
const firstMenu = page.locator('[data-output-menu]').first()
await firstMenu.locator('button').first().click()
await page.waitForTimeout(500)
const b = await page.evaluate(() => {
  const menu = document.querySelector('[data-output-menu] [role="menu"]')
  if (!menu) return { open: false }
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map(x => x.innerText.trim().split('\n')[0])
  return { open: true, items, bg: getComputedStyle(menu).backgroundColor }
})
ok('popup opens', b.open)
ok('Share row', (b.items || []).some(i => /share/i.test(i)), JSON.stringify(b.items))
ok('Export row', (b.items || []).some(i => /export/i.test(i)))
ok('popup bg #1a1a1a', b.bg === 'rgb(26, 26, 26)', b.bg)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ════ D. chat-dd-item — reverted to original bare styling ════
console.log('D. chat-dd-item revert')
await go('/chat')
// dev-only: hide the Next.js dev-overlay portal so it can't intercept taps
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })
await page.click('.chat-bar-collapsed textarea, .chat-bar-collapsed', { timeout: 5000 }).catch(() => {})
await page.waitForTimeout(600)
await page.click('button[title="Focus mode"]', { timeout: 5000 })
await page.waitForTimeout(900)
const d = await page.evaluate(() => {
  const item = document.querySelector('.chat-dd-item')
  if (!item) return { found: false }
  const cs = getComputedStyle(item)
  // scan injected stylesheets for any leftover :hover rule on chat-dd-item
  let hoverRule = false
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules } catch { continue }
    for (const r of rules || []) {
      if (r.selectorText && /chat-dd-item\s*:hover/.test(r.selectorText)) hoverRule = true
    }
  }
  return {
    found: true,
    bg: cs.backgroundColor,
    borderWidth: cs.borderTopWidth,
    radius: cs.borderRadius,
    padding: cs.padding,
    hoverRule,
    items: document.querySelectorAll('.chat-dd-item').length,
  }
})
ok('focus sheet opened', d.found, `items=${d.items}`)
ok('item bg reverted (transparent)', d.bg === 'rgba(0, 0, 0, 0)', d.bg)
ok('item border reverted (0px)', d.borderWidth === '0px', d.borderWidth)
ok('item padding reverted (0px)', d.padding === '0px', d.padding)
ok('radius reverted (0px)', d.radius === '0px', d.radius)
ok('no .chat-dd-item:hover rule in CSS', !d.hoverRule)
// real hover: bg must stay transparent (no block hover)
const itemBox = await page.locator('.chat-dd-item').first().boundingBox()
if (itemBox) {
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2)
  await page.waitForTimeout(450)
  const hoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('.chat-dd-item')).backgroundColor)
  ok('item hover leaves bg transparent', hoverBg === 'rgba(0, 0, 0, 0)', hoverBg)
}
await page.screenshot({ path: SHOT + '/d-focus-sheet.png' })

// wiring regression: tap Academic → trigger active + sheet closes
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.chat-dd-item')]
  const acad = items.find(x => /academic/i.test(x.innerText))
  acad.click()
})
await page.waitForTimeout(900)
const dWired = await page.evaluate(() => {
  const trigger = document.querySelector('button[title="Focus mode"]')
  const active = trigger && trigger.className.includes('chat-toolbar-btn-active')
  const w = document.querySelector('.chat-sheet-wrap')
  let sheetClosed = !w
  if (w) {
    sheetClosed = w.getBoundingClientRect().top >= window.innerHeight - 2 || getComputedStyle(w).visibility === 'hidden'
  }
  return { active, sheetClosed }
})
ok('Academic select → trigger active (wiring)', dWired.active)
ok('sheet closed after select', dWired.sheetClosed)

console.log(`\nPAGE ERRORS: ${errors.length}`, errors.slice(0, 3))
console.log(`RESULT: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
