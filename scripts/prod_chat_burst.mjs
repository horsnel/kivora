// v5.30.24 burst probe: N rapid anonymous chat POSTs from a real browser
// context to push past SiliconFlow/SambaNova RPM limits so some requests
// reach the groq-gateway hop (currently 401ing until the gateway token
// lands — those 401s are the prod→gateway egress proof in gateway logs).
import { chromium } from 'playwright'

const N = parseInt(process.env.BURST_N || '14', 10)
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('https://kivora.pages.dev/', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(1500)

const t0 = Date.now()
const results = await page.evaluate(async (N) => {
  const out = []
  for (let i = 0; i < N; i++) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Reply with one word: BURST' }],
          sessionId: 'burst-v53024-' + i,
        }),
      })
      let reply = null
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const j = await res.json().catch(() => null)
        reply = j?.reply || j?.content || (j?.error ? 'ERR:' + j.error.slice(0, 40) : null)
      } else {
        const text = await res.text().catch(() => '')
        reply = text.slice(0, 20)
      }
      out.push({ i, status: res.status, reply: String(reply || '').slice(0, 20) })
    } catch (e) {
      out.push({ i, status: 0, reply: 'FETCH-ERR' })
    }
  }
  return out
}, N)
console.log('burst wall time:', Math.round((Date.now() - t0) / 1000) + 's for ' + N + ' requests')
const okCount = results.filter(r => r.status === 200).length
console.log('200s:', okCount + '/' + N, '| non-200 statuses:', JSON.stringify(results.filter(r => r.status !== 200)))
console.log('BURST', okCount >= Math.floor(N * 0.5) ? 'PASS' : 'DEGRADED')
await browser.close()
