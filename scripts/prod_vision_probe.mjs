// v5.30.24 vision probe: POST /api/vision with a tiny PNG data-URL from a
// real browser context. The image-bearing chain tries groq-gateway FIRST
// (GROQ_GATEWAY_URL set, hop available) — currently 401 without the gateway
// token, then fail-opens to groq-primary (Vercel proxy) which serves. The
// gateway's own logs record the 401 → prod→gateway egress proof.
import { chromium } from 'playwright'

// 8x8 red PNG, valid base64 (stable bytes, no image lib needed)
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4GBgYGJgQoAAF9lAgMFXL9UAAAAAElFTkSuQmCC'

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
await page.goto('https://kivora.pages.dev/', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(1500)

const result = await page.evaluate(async (b64) => {
  const t0 = Date.now()
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: `data:image/png;base64,${b64}`,
      prompt: 'What color is this square? One word.',
    }),
  })
  const dt = Date.now() - t0
  const j = await res.json().catch(() => null)
  return { status: res.status, latencyMs: dt, body: j }
}, PNG_B64)
console.log(JSON.stringify({
  status: result.status,
  latency_s: Math.round(result.latencyMs / 100) / 10,
  keys: result.body ? Object.keys(result.body) : null,
  desc: result.body?.description || result.body?.reply || result.body?.content || JSON.stringify(result.body || {}).slice(0, 140),
}, null, 1))
console.log('VISION PROBE', result.status === 200 ? 'PASS' : 'FAIL')
await browser.close()
