// Prod probe for v5.30.22: POST /api/research with a real image FROM inside
// a real browser context (CF WAF blocks non-browser signatures with 1010 —
// in-page fetch behaves exactly like a user's client).
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto('https://kivora.pages.dev/research', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(3000)

const result = await page.evaluate(async () => {
  // 1x1-ish real PNG (blue square) drawn in-page — no external fetch needed
  const c = document.createElement('canvas')
  c.width = 48; c.height = 48
  const g = c.getContext('2d')
  g.fillStyle = 'rgb(30,90,200)'
  g.fillRect(0, 0, 48, 48)
  const dataUrl = c.toDataURL('image/png')
  const t0 = Date.now()
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'what is this blue square?',
      mode: 'quick',
      attachedFile: { name: 'probe.png', type: 'image/png', size: dataUrl.length, content: dataUrl },
    }),
  })
  const dt = Date.now() - t0
  let body = null
  try { body = await res.json() } catch { body = { raw: (await res.text()).slice(0, 200) } }
  return { status: res.status, latencyMs: dt, body: { sources: body.sources, report: body.report, selfHealed: body.selfHealed, error: body.error } }
})
console.log(JSON.stringify({
  status: result.status,
  latency_s: Math.round(result.latencyMs / 100) / 10,
  sourceCount: (result.body.sources || []).length,
  selfHealed: !!result.body.selfHealed,
  error: result.body.error || null,
  reportChars: (result.body.report || '').length,
  firstSource: result.body.sources?.[0 ? 0 : 0]?.url?.slice(0, 90) || null,
}, null, 1))
console.log('PROBE', result.status === 200 && (result.body.sources || []).length > 0 ? 'PASS' : 'FAIL')
await browser.close()
