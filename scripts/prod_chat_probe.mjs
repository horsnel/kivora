// Prod probe for v5.30.23: anonymous chat POST from a real browser context
// (CF WAF blocks non-browser signatures). The gateway hop is INACTIVE until
// GROQ_GATEWAY_URL is set — this proves the shipped chain still serves.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('https://kivora.pages.dev/', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(2000)

const result = await page.evaluate(async () => {
  const t0 = Date.now()
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Reply with exactly one word: PONG' }],
      sessionId: 'probe-v53023',
    }),
  })
  const dt = Date.now() - t0
  const ct = res.headers.get('content-type') || ''
  let out
  if (ct.includes('text/event-stream')) {
    const text = await res.text()
    // pull the final payload frame (done event carries data)
    let reply = null
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue
      try {
        const evt = JSON.parse(line.slice(5))
        if (evt.type === 'done' && evt.data) reply = evt.data
      } catch {}
    }
    out = { kind: 'sse', reply }
  } else {
    out = { kind: 'json', body: await res.json().catch(() => null) }
  }
  return { status: res.status, latencyMs: dt, contentType: ct, ...out }
})

const reply = result.reply || result.body || {}
const content = reply.reply || reply.content || reply.report || ''
console.log(JSON.stringify({
  status: result.status,
  latency_s: Math.round(result.latencyMs / 100) / 10,
  kind: result.kind,
  replyPreview: typeof content === 'string' ? content.slice(0, 80) : JSON.stringify(content).slice(0, 120),
}, null, 1))
console.log('PROBE', result.status === 200 ? 'PASS' : 'FAIL')
await browser.close()
