// one-shot hydration diagnostic: load /chat, capture console + errors,
// report whether React hydrates and what breaks
import { chromium } from 'playwright'
const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
const logs = []
page.on('console', msg => {
  const t = msg.text()
  if (/hydrat|mismatch|error|Error|warning/i.test(t)) logs.push(`${msg.type()}: ${t.slice(0, 300)}`)
})
page.on('pageerror', e => logs.push(`PAGEERROR: ${String(e).slice(0, 300)}`))
await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(20000)
const state = await page.evaluate(() => ({
  collapsed: !!document.querySelector('input.chat-collapsed-input'),
  expanded: !!document.querySelector('.chat-container-expanded'),
  textareas: document.querySelectorAll('textarea').length,
  reactProps: (() => { const el = document.querySelector('input.chat-collapsed-input'); if (!el) return 'no-el'; return Object.keys(el).filter(k => k.startsWith('__react')).join(',') || 'no-react-props' })(),
  loads: performance.getEntriesByType('navigation').length,
  head: document.body.innerText.slice(0, 150).replace(/\n/g, ' | '),
}))
console.log('STATE:', JSON.stringify(state, null, 1))
console.log('CONSOLE/ERRORS:', logs.length)
logs.slice(0, 12).forEach(l => console.log('  ', l))
await browser.close()
