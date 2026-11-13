// v5.30.24 vision probe: POST /api/vision with a tiny PNG data-URL from a
// real browser context. The image-bearing chain tries groq-gateway FIRST
// (GROQ_GATEWAY_URL set, hop available) — currently 401 without the gateway
// token, then fail-opens to groq-primary (Vercel proxy) which serves. The
// gateway's own logs record the 401 → prod→gateway egress proof.
import { chromium } from 'playwright'

// 128x128 red square with a yellow circle (PIL-generated; Groq rejects
// tiny/placeholder PNGs with "invalid image data")
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAACZklEQVR4nO2dQU5DMQwFfxHnYN01R+DgHIETsOIkLCKhr1ZIRdgeJ5lZV8L25Pn/SlS5fF6vh3A80QXsjgJgFACjABgFwCgARgEwCoBRAIwCYBQAowAYBcAoAEYBMAqAUQCMAmAUAKMAGAXAKABGATDPdAF/4+X99ZGPfb19ZFcSxaX/P2Y9OPTfaC6jr4B/zv2enibaCQif+z2tTDQSUDD6M000tBBQPPozuAb+NRScPv7XDzYBePNnqChgCWg1/YOrhxHQbfoDpKrqFdRz9DdUrqPSBEwx/aO2zjoBs0x/UFZtkYC5pj+oqZn/HrA5FQJmPP6DgsrTBcw7/UF2/bkCZp/+ILULnwEwiQLWOP6DvF6yBKw0/UFSR64gmBQB6x3/QUZfJgAmXsCqx38Q3p0JgFEATLCAtffPILZHEwCjAJhIATvsn0FgpyYARgEwCoAJE7DPA2AQ1a8JgFEAjAJgFACjABgFwCgARgEwCoBRAIwCYBQAEyYA/8l5MVH9mgAYBcAoACZSwD6PgcBOTQCMAmCCBeywhWJ7NAEwCoCJF7D2FgrvzgTApAhYNQQZfZkAmCwB64UgqaPEBKzkIK8XVxBMroA1QpDaRXoCZneQXX/FCprXQUHlPgNgigTMGIKamusSMJeDsmpLV9AsDirrZO4PaPuLvvojwjyEe0YBqQp7C+rmgKqHv8QHX0fsUeC/B7D940HkE/CD94i1wJv0uuBdkl3wNtVGeJ+wBMO/hm6OAmAUAKMAGAXAKABGATAKgFEAjAJgFACjABgFwCgARgEwCoBRAIwCYBQAowAYBcAoAOYba+2gs8ePX0cAAAAASUVORK5CYII='

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
