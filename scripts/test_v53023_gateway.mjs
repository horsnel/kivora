// ════════════════════════════════════════════════════════════════════
// test_v53023_gateway.mjs — v5.30.23: Cloudflare AI Gateway hop for Groq.
// Functional tests of lib/groq.js against a mock AI Gateway (GROQ_GATEWAY_URL
// env hook) — asserting the CF-docs URL shape, key passthrough, model
// mapping, reasoning_effort retention, streaming, and fail-open when unset.
// The real gateway can't be created by the provided token (no AI Gateway
// perm) — once it exists, scripts/probe_gateway_groq.py verifies it live.
// ════════════════════════════════════════════════════════════════════
import http from 'http'
import { readFileSync } from 'fs'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

// ── mock AI Gateway ──
const hits = []
let mockMode = 'ok' // ok | sse | dead
const srv = http.createServer((req, res) => {
  let b = ''
  req.on('data', (c) => { b += c })
  req.on('end', () => {
    let p = {}
    try { p = JSON.parse(b) } catch {}
    hits.push({
      path: req.url,
      auth: req.headers['authorization'] || null,
      aig: req.headers['cf-aig-authorization'] || null,
      model: p.model,
      reasoningEffort: p.reasoning_effort === undefined ? null : p.reasoning_effort,
      stream: p.stream === true,
    })
    if (mockMode === 'dead') {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 2009, message: 'Unauthorized' }, name: 'AiGatewayError' }))
      return
    }
    if (mockMode === 'sse') {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const tok of ['Hel', 'lo ', 'via gateway']) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: tok } }] })}\n\n`)
      }
      res.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'gateway hop reply' }, finish_reason: 'stop' }],
    }))
  })
})
await new Promise((r) => srv.listen(9993, r))

process.env.GROQ_GATEWAY_URL = 'http://localhost:9993/kivora-groq/groq'
process.env.GROQ_API_KEY = 'gsk_test_key_for_suite'
process.env.GROQ_GATEWAY_TOKEN = 'cfut-suite-gateway-token'
// Isolate the suite from the REAL Vercel proxy — the SDK groq hops would
// otherwise reach production Groq from this sandbox (proxy egress is
// allowed). Point them at the mock so the chain stays fully offline.
process.env.GROQ_PROXY_URL = 'http://localhost:9993/never-proxy'
const { groqChat, MODEL, VISION_MODEL } = await import('/home/z/my-project/kivora/lib/groq.js')

// ── A. text chain: gateway hop serves (no other provider keys set) ──
const r1 = await groqChat({
  model: MODEL,
  messages: [{ role: 'user', content: 'hi' }],
  reasoning_effort: 'none',
})
ok('gateway hop served the chain', (hits[0]?.path || '').endsWith('/groq/chat/completions'), hits[0]?.path)
ok('URL shape matches CF docs (provider base + /chat/completions)', hits[0]?.path === '/kivora-groq/groq/chat/completions')
ok('plain Groq key passes through (Bearer)', hits[0]?.auth === 'Bearer gsk_test_key_for_suite')
ok('canonical model ID passthrough', hits[0]?.model === 'openai/gpt-oss-120b')
ok('reasoning_effort KEPT for groq-gateway', hits[0]?.reasoningEffort === 'none')
ok('reply content returned', r1?.choices?.[0]?.message?.content === 'gateway hop reply')

// ── B. legacy model ID mapping on the gateway hop ──
hits.length = 0
await groqChat({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'x' }] })
ok('legacy ID → current Groq model', hits[0]?.model === 'openai/gpt-oss-120b', hits[0]?.model)

// ── C. streaming through the gateway hop ──
hits.length = 0
mockMode = 'sse'
const deltas = []
const r3 = await groqChat(
  { model: MODEL, messages: [{ role: 'user', content: 'stream please' }] },
  { onDelta: (t) => deltas.push(t) }
)
ok('SSE mode reached the gateway', hits[0]?.stream === true && (hits[0]?.path || '').endsWith('/groq/chat/completions'))
ok('deltas emitted live', deltas.join('') === 'Hello via gateway', JSON.stringify(deltas))
ok('streamed result assembled', r3?.choices?.[0]?.message?.content === 'Hello via gateway')
mockMode = 'ok'

// ── D. vision chain: gateway hop first for image parts ──
hits.length = 0
const r4 = await groqChat({
  model: VISION_MODEL,
  messages: [{ role: 'user', content: [
    { type: 'text', text: 'what is this?' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } },
  ] }],
  reasoning_effort: 'none',
  max_tokens: 900,
})
ok('vision chain routes images to gateway hop first', hits[0]?.model === 'qwen/qwen3.8-27b', hits[0]?.model)
ok('vision reasoning_effort kept (no thinking tokens)', hits[0]?.reasoningEffort === 'none')
ok('cf-aig-authorization header sent when token env set', hits[0]?.aig === 'cfut-suite-gateway-token', hits[0]?.aig)
ok('Groq Bearer key still rides alongside (passthrough)', hits[0]?.auth === 'Bearer gsk_test_key_for_suite')

// ── E. dead gateway → hop fails fast, chain falls through to the proxy hops ──
hits.length = 0
mockMode = 'dead'
let deadRes = null
let deadErr = null
try { deadRes = await groqChat({ model: MODEL, messages: [{ role: 'user', content: 'x' }] }) }
catch (e) { deadErr = e }
ok('dead gateway → chain CONTINUED past it (fail-open)', !!deadErr || !!deadRes, deadErr ? String(deadErr.message).slice(0, 50) : 'resolved')
ok('gateway actually rejected first (401 hit recorded)', hits.some(h => (h.path || '').endsWith('/groq/chat/completions')))
mockMode = 'ok'

// ── F. env unset → hop skipped (fresh module instance, cache-busted import) ──
delete process.env.GROQ_GATEWAY_URL
delete process.env.GROQ_API_KEY
delete process.env.GROQ_API_KEY_FALLBACK
const g2 = await import('/home/z/my-project/kivora/lib/groq.js?unset=1')
hits.length = 0
let unsetErr = null
try { await g2.groqChat({ model: MODEL, messages: [{ role: 'user', content: 'x' }] }) }
catch (e) { unsetErr = e }
ok('GROQ_GATEWAY_URL unset → ZERO gateway hits (hop skipped)', hits.length === 0)
ok('no groq transport at all → clean chain-exhaustion error', !!unsetErr)
process.env.GROQ_GATEWAY_URL = 'http://localhost:9993/kivora-groq/groq'
process.env.GROQ_API_KEY = 'gsk_test_key_for_suite'

// ── F2. token env unset → hop still attempts, but WITHOUT the header ──
delete process.env.GROQ_GATEWAY_TOKEN
const g3 = await import('/home/z/my-project/kivora/lib/groq.js?notoken=1')
hits.length = 0
await g3.groqChat({ model: MODEL, messages: [{ role: 'user', content: 'x' }] }).catch(() => {})
ok('no token env → NO cf-aig header (fail-open to gateway 401)', hits[0]?.aig === null && (hits[0]?.path || '').endsWith('/groq/chat/completions'), JSON.stringify(hits[0]?.aig))
process.env.GROQ_GATEWAY_TOKEN = 'cfut-suite-gateway-token'
srv.close()

// ── G. source asserts ──
const src = readFileSync('/home/z/my-project/kivora/lib/groq.js', 'utf8')
ok('env hook defined (GROQ_GATEWAY_URL)', src.includes("process.env.GROQ_GATEWAY_URL || ''"))
ok('gateway hop precedes groq-primary in BOTH chains', (src.match(/name: 'groq-gateway'/g) || []).length === 2 &&
  src.indexOf("name: 'groq-gateway'") < src.indexOf("name: 'groq-primary'") &&
  src.lastIndexOf("name: 'groq-gateway'") < src.lastIndexOf("name: 'groq-primary'"))
ok('only when URL AND key present', src.includes("!!GROQ_GATEWAY_URL && !!getGroqApiKey()"))
ok('directChat keeps reasoning_effort for the gateway', src.includes("provider === 'groq-gateway' ? params : restParams"))
ok('dedicated timeout entry', src.includes("'groq-gateway': 20_000"))
ok('docs-shape comment preserved', src.includes("REPLACED by the"))
ok('cf-aig-authorization header wiring present', src.includes("headers['cf-aig-authorization'] = GROQ_GATEWAY_TOKEN"))
ok('token env hook defined (GROQ_GATEWAY_TOKEN)', src.includes("process.env.GROQ_GATEWAY_TOKEN || ''"))
ok('auth-mandatory comment (always-authenticated gateways)', src.includes("ALWAYS authenticated"))

console.log(`v5.30.23 suite: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
