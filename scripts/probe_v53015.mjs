// v5.30.15 visual probe — AIActionCard inside the real /chat page.
// The card HTML is rendered by the esbuild harness (real component + real
// i18n), injected into the live page DOM so the app's Tailwind classes
// resolve, then chrome + typography are asserted on computed styles.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const SHOT = '/tmp/v53015'
mkdirSync(SHOT, { recursive: true })

// 1. render the real component via the harness bundle
execFileSync('./node_modules/.bin/esbuild', [
  'scripts/v53015_card_harness.jsx',
  '--bundle', '--platform=node', '--format=cjs',
  '--alias:@=.', '--tsconfig=scripts/tsconfig.harness.json',
  '--outfile=/tmp/v53015-harness.cjs',
  '--log-level=error',
], { cwd: process.cwd(), stdio: 'pipe' })
const { renderCard } = createRequire(import.meta.url)('/tmp/v53015-harness.cjs')

const cardHtml = renderCard({
  toolName: 'sandbox_git',
  title: 'Cloning Appwrite Repo',
  args: {
    url: 'https://github.com/appwrite/appwrite',
    branch: 'main',
    target_dir: 'appwrite',
  },
  rawJson: '{"name":"sandbox_git","arguments":{"url":"https://github.com/appwrite/appwrite"}}',
  valid: true,
})
const cardHtmlUnknown = renderCard({
  toolName: 'mystery_tool',
  title: 'Untitled action',
  args: null,
  rawJson: '{"name":"mystery_tool","arguments":{"x":1}}',
  valid: false,
})

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 120)))

await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(1500)
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })

// 2. inject into the real page so Tailwind resolves
const c = await page.evaluate(({ html, htmlUnknown }) => {
  const host = document.querySelector('main') || document.body
  const wrap = document.createElement('div')
  wrap.setAttribute('data-probe-cards', '')
  wrap.className = 'px-4 py-6'
  wrap.innerHTML =
    '<p style="color:#9ca3af;font-size:12px;margin:0 0 4px">Let me clone that for you.</p>' +
    html +
    '<p style="color:#9ca3af;font-size:12px;margin:4px 0 16px">Running it now.</p>' +
    htmlUnknown
  host.appendChild(wrap)
  const card = wrap.children[1]
  const cs = getComputedStyle(card)
  const badge = card.querySelector('span')
  const pre = card.querySelector('pre')
  const preInner = pre ? pre.querySelector('div') : null
  return {
    bg: cs.backgroundColor,
    border: cs.borderTopColor,
    radius: cs.borderRadius,
    badgeColor: badge ? getComputedStyle(badge).color : null,
    preBg: pre ? getComputedStyle(pre).backgroundColor : null,
    preFont: preInner ? getComputedStyle(preInner).fontFamily.toLowerCase() : '',
    text: wrap.innerText,
  }
}, { html: cardHtml, htmlUnknown: cardHtmlUnknown })

ok('card bg #111', c.bg === 'rgb(17, 17, 17)', c.bg)
ok('card border #262626', c.border === 'rgb(38, 38, 38)', c.border)
ok('radius 16px (rounded-2xl)', c.radius === '16px', c.radius)
ok('badge accent #FF3366', c.badgeColor === 'rgb(255, 51, 102)', c.badgeColor)
ok('pre body #0f0f0f', c.preBg === 'rgb(15, 15, 15)', c.preBg)
ok('mono font in body (JetBrains/monospace)', /jetbrains|mono/i.test(c.preFont), c.preFont.slice(0, 50))
ok('badge label resolved via i18n', /action/i.test(c.text))
ok('title shown', c.text.includes('Cloning Appwrite Repo'))
ok('tool name chip shown', /sandbox_git/i.test(c.text))
ok('args JSON shown', c.text.includes('https://github.com/appwrite/appwrite'))
ok('footer label', /system action payload/i.test(c.text))
ok('unparsed footer variant', /unrecognized action payload/i.test(c.text))
await page.screenshot({ path: SHOT + '/cards-in-chat.png', fullPage: false })
// scroll the injected cards into view for the screenshot
await page.evaluate(() => {
  const el = document.querySelector('[data-probe-cards]')
  if (el) el.scrollIntoView({ block: 'center' })
})
await page.waitForTimeout(300)
await page.screenshot({ path: SHOT + '/cards-in-chat.png' })

console.log(`PAGE ERRORS: ${errors.length}`, errors.slice(0, 3))
console.log(`RESULT: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
