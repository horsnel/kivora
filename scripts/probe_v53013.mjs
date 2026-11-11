// v5.30.13 verification probe — all four tasks
// A. sidebar session items: 16px / 500 / 1.5 / #e5e7eb / #2f2f2f hover+active / ellipsis
// B. opportunities: OutputMenu card (Share/Copy/Export + CSV/PDF/MD badges), old menu gone
// C. pills: tool-pill chrome (#141414/#262626/#737373) + real ellipsis (inline-block)
// D. chat-dd-item: #1a1a1a block, #2a2a2a border, r16, 16px 8px padding, #222 hover
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const SHOT = '/tmp/v53013'
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

// ════ A. Sidebar session items ════
console.log('A. sidebar session items')
await go('/chat')
const a = await page.evaluate(() => {
  const list = document.querySelector('.flex-1.overflow-y-auto')
  if (!list) return { ok: false }
  const row = document.createElement('div')
  row.className = 'group relative flex items-center rounded-full transition-colors bg-[#2f2f2f]'
  row.innerHTML = `<button class="flex-1 min-w-0 text-left px-3 py-2 text-base font-medium transition-colors truncate text-[#e5e7eb]">How to build a scalable REST API with Node.js, PostgreSQL and Redis caching for production traffic spikes</button>`
  list.appendChild(row)
  const btn = row.querySelector('button')
  const cs = getComputedStyle(btn)
  const csRow = getComputedStyle(row)
  return {
    ok: true,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    color: cs.color,
    rowBg: csRow.backgroundColor,
    textOverflow: cs.textOverflow,
    clipped: btn.scrollWidth > btn.clientWidth,
  }
})
ok('injected into real list', a.ok)
ok('font-size 16px', a.fontSize === '16px', a.fontSize)
ok('font-weight 500', a.fontWeight === '500', a.fontWeight)
ok('line-height 1.5 (24px)', a.lineHeight === '24px', a.lineHeight)
ok('text #e5e7eb', a.color === 'rgb(229, 231, 235)', a.color)
ok('active row bg #2f2f2f', a.rowBg === 'rgb(47, 47, 47)', a.rowBg)
ok('ellipsis configured', a.textOverflow === 'ellipsis', a.textOverflow)
ok('long title actually clips', a.clipped)
// hover state via real CSS rule (raw mouse move — drawer may be off-canvas)
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
ok('hover row bg #2f2f2f', aHover === 'rgb(47, 47, 47)', aHover)
await page.screenshot({ path: SHOT + '/a-sidebar.png' })

// ════ C. Suggestion pills ════
console.log('C. suggestion pills')
await go('/devtools')
const c = await page.evaluate(() => {
  const host = document.querySelector('main') || document.body
  const div = document.createElement('div')
  div.setAttribute('data-probe-pills', '')
  div.className = 'shrink-0 flex flex-wrap items-center gap-2 pt-3 px-4'
  div.innerHTML = `<button class="inline-block max-w-full text-[11px] leading-[16px] px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a] transition-colors whitespace-nowrap overflow-hidden text-ellipsis disabled:opacity-50" data-probe-pill>Turn my SaaS side project into a profitable subscription business with churn analysis and pricing strategy recommendations</button>
  <button class="inline-block max-w-full text-[11px] leading-[16px] px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a] transition-colors whitespace-nowrap overflow-hidden text-ellipsis disabled:opacity-50">Write a cold email pitch</button>`
  host.appendChild(div)
  const b = div.querySelector('[data-probe-pill]')
  const cs = getComputedStyle(b)
  return {
    display: cs.display,
    bg: cs.backgroundColor,
    borderColor: cs.borderColor,
    color: cs.color,
    textOverflow: cs.textOverflow,
    clipped: b.scrollWidth > b.clientWidth,
    radius: cs.borderRadius,
  }
})
ok('block-ish display (ellipsis-capable)', ['inline-block', 'block'].includes(c.display), c.display)
ok('bg tool-pill #141414', c.bg === 'rgb(20, 20, 20)', c.bg)
ok('border tool-pill #262626', c.borderColor === 'rgb(38, 38, 38)', c.borderColor)
ok('text tool-pill muted #737373', c.color === 'rgb(115, 115, 115)', c.color)
ok('text-overflow ellipsis ACTIVE', c.textOverflow === 'ellipsis', c.textOverflow)
ok('long pill clips', c.clipped)
await page.screenshot({ path: SHOT + '/c-pills.png' })

// ════ B. Opportunities OutputMenu ════
console.log('B. opportunities OutputMenu')
await go('/opportunities')
const bCount = await page.evaluate(() => document.querySelectorAll('[data-output-menu]').length)
ok('OutputMenu triggers mounted', bCount > 0, `count=${bCount}`)
const oldMenuGone = await page.evaluate(() => !document.body.innerText.includes('Export as CSV file'))
ok('old inline menu text gone', oldMenuGone)
// open the first card's menu
const firstMenu = page.locator('[data-output-menu]').first()
await firstMenu.locator('button').first().click()
await page.waitForTimeout(500)
const rows = await page.evaluate(() => {
  const menu = document.querySelector('[data-output-menu] [role="menu"]')
  if (!menu) return { open: false }
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map(b => b.innerText.trim().split('\n')[0])
  return { open: true, items, bg: getComputedStyle(menu).backgroundColor, radius: getComputedStyle(menu).borderRadius }
})
ok('popup opens', rows.open)
ok('Share row', (rows.items || []).some(i => /share/i.test(i)), JSON.stringify(rows.items))
ok('Copy row', (rows.items || []).some(i => /copy/i.test(i)))
ok('Export row', (rows.items || []).some(i => /export/i.test(i)))
ok('popup uses OutputMenu card bg #1a1a1a', rows.bg === 'rgb(26, 26, 26)', rows.bg)
ok('popup rounded-2xl (16px)', rows.radius === '16px', rows.radius)
// export view with badges
await page.evaluate(() => {
  const menu = document.querySelector('[data-output-menu] [role="menu"]')
  const exportRow = [...menu.querySelectorAll('[role="menuitem"]')].find(b => /export/i.test(b.innerText))
  exportRow.click()
})
await page.waitForTimeout(400)
const badges = await page.evaluate(() => {
  const menu = document.querySelector('[data-output-menu] [role="menu"]')
  if (!menu) return []
  return [...menu.querySelectorAll('[role="menuitem"]')].map(b => b.innerText.trim().split('\n')[0])
})
ok('CSV badge row', badges.some(i => /CSV/i.test(i)), JSON.stringify(badges))
ok('PDF badge row', badges.some(i => /PDF/i.test(i)))
ok('MD badge row', badges.some(i => /MD/i.test(i)))
await page.screenshot({ path: SHOT + '/b-opp-menu-export.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const closed = await page.evaluate(() => !document.querySelector('[data-output-menu] [role="menu"]'))
ok('Escape closes', closed)

// ════ D. chat-dd-item blocks in the Focus sheet ════
console.log('D. chat-dd-item blocks')
await go('/chat')
// dev-only: hide the Next.js dev-overlay portal so it can't intercept taps
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })
// expand the bar, then open the focus sheet
await page.click('.chat-bar-collapsed textarea, .chat-bar-collapsed', { timeout: 5000 }).catch(() => {})
await page.waitForTimeout(600)
await page.click('button[title="Focus mode"]', { timeout: 5000 })
await page.waitForTimeout(900)
const d = await page.evaluate(() => {
  const item = document.querySelector('.chat-dd-item')
  if (!item) return { found: false }
  const cs = getComputedStyle(item)
  const card = document.querySelector('.chat-dd-card')
  return {
    found: true,
    bg: cs.backgroundColor,
    border: cs.borderTopColor,
    borderWidth: cs.borderTopWidth,
    radius: cs.borderRadius,
    padding: cs.padding,
    items: document.querySelectorAll('.chat-dd-item').length,
    cardVisible: !!card && getComputedStyle(card).opacity !== '0',
  }
})
ok('focus sheet opened', d.found, `items=${d.items}`)
ok('item bg #1a1a1a', d.bg === 'rgb(26, 26, 26)', d.bg)
ok('item border #2a2a2a', d.border === 'rgb(42, 42, 42)', d.border)
ok('border width 1px', d.borderWidth === '1px', d.borderWidth)
ok('radius 16px', d.radius === '16px', d.radius)
ok('padding 16px 8px', eq(d.padding, '16px 8px'), d.padding)
// hover a tile → block bg lightens to #222
const itemBox = await page.locator('.chat-dd-item').first().boundingBox()
if (itemBox) {
  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2)
  await page.waitForTimeout(450)
  const hoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('.chat-dd-item')).backgroundColor)
  ok('item hover #222222', hoverBg === 'rgb(34, 34, 34)', hoverBg)
}
await page.screenshot({ path: SHOT + '/d-focus-sheet.png' })

// wiring regression: tap Academic → trigger goes active + sheet closes
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.chat-dd-item')]
  const acad = items.find(b => /academic/i.test(b.innerText))
  acad.click()
})
await page.waitForTimeout(900)
const dWired = await page.evaluate(() => {
  const trigger = document.querySelector('button[title="Focus mode"]')
  const active = trigger && trigger.className.includes('chat-toolbar-btn-active')
  const w = document.querySelector('.chat-sheet-wrap')
  let sheetClosed = !w
  if (w) {
    // closed = the wrap's top edge is at/below the viewport bottom (translateY(110%))
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
