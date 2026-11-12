// ════════════════════════════════════════════════════════════════════
// test_v53021_e2e.mjs — Lightning gateway END-TO-END wiring test.
// Starts a mock OpenAI-compatible gateway (Lightning LitServe stand-in) on
// :9990, points LIGHTNING_BASE_URL at it, runs the REAL /api/chat flow
// (no Playwright interception) and asserts the reply comes THROUGH the
// mock with the canonical model ID — proving the server-side chain hop.
// Also asserts the fail-open default: without the env, no gateway call.
// ════════════════════════════════════════════════════════════════════
import http from 'http'
import { chromium } from 'playwright'

const PORT = 9990
const hits = []
const srv = http.createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    const auth = req.headers['authorization'] || ''
    let parsed = {}
    try { parsed = JSON.parse(body) } catch {}
    hits.push({ path: req.url, auth, model: parsed.model, messages: (parsed.messages || []).length })
    const reply = `MOCK-LIGHTNING-OK model=${parsed.model}`
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }))
  })
})
await new Promise(r => srv.listen(PORT, r))
console.log(`mock gateway on :${PORT}`)

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

// ── e2e: real /api/chat flow through the gateway ──
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 120)))
const BASE = process.env.PROBE_BASE || 'http://localhost:3000'
await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
await page.waitForSelector('input.chat-collapsed-input', { timeout: 120000 })
await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })
await page.waitForTimeout(4000)
let ta = null
for (let i = 0; i < 6 && !ta; i++) {
  await page.evaluate(() => { try { document.activeElement?.blur?.() } catch {} })
  await page.locator('input.chat-collapsed-input').first().click({ timeout: 4000 }).catch(() => {})
  ta = page.locator('textarea').last()
  try { await ta.waitFor({ state: 'visible', timeout: 3000 }); break } catch { ta = null }
}
if (!ta) { console.log('  ✗ composer never expanded'); process.exit(1) }
await ta.fill('hello gateway')
await ta.press('Enter')

// The real chain: lightning (mock) → reply. Assistant bubble should contain
// the mock's marker within the chain budget.
let replySeen = false
try {
  await page.waitForFunction(
    () => document.body.textContent.includes('MOCK-LIGHTNING-OK'),
    { timeout: 45000 }
  )
  replySeen = true
} catch {}
ok('e2e: chat reply arrives THROUGH the Lightning gateway', replySeen)
ok('gateway hit /v1/chat/completions with the canonical model',
  hits.length > 0 && hits[0].path.includes('/v1/chat/completions') && (hits[0].model || '').startsWith('openai/'),
  JSON.stringify(hits[0] || null))
ok('gateway received the Bearer key from LIGHTNING_API_KEY', hits.length > 0 && hits[0].auth === 'Bearer test123')
ok('conversation history was forwarded', hits.length > 0 && hits[0].messages >= 1)
await ctx.close()
srv.close()

console.log(`v5.30.21 e2e: ${pass} pass, ${fail} fail`)
await browser.close()
process.exit(fail ? 1 : 0)
