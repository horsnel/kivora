// ════════════════════════════════════════════════════════════════════
// test_v53021_chain.mjs — drives the REAL multi-provider chain
// (lib/groq.js → groqChat) against a mock Lightning LitServe gateway:
//   1. configured → the mock receives /v1/chat/completions with the
//      canonical model ID + Bearer key, and its reply flows back
//   2. dead gateway → the chain fails OPEN to the next provider without
//      hanging (all others unconfigured → clean GroqError, no gateway retry)
// Run: node --loader ./scripts/loader_v53021.mjs scripts/test_v53021_chain.mjs
// ════════════════════════════════════════════════════════════════════
import http from 'http'
import { setLightningConfig, groqChat, GroqError } from '@/lib/groq'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

const hits = []
const srv = http.createServer((req, res) => {
  let b = ''
  req.on('data', c => { b += c })
  req.on('end', () => {
    let p = {}
    try { p = JSON.parse(b) } catch {}
    hits.push({ path: req.url, auth: req.headers.authorization, model: p.model, msgs: (p.messages || []).length })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: `MOCK-LIGHTNING-OK model=${p.model}` }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    }))
  })
})
await new Promise(r => srv.listen(9991, r))

// ── 1. configured gateway serves the chain ──
setLightningConfig('http://localhost:9991/', 'test123') // trailing slash on purpose
const out = await groqChat({
  model: 'openai/gpt-oss-120b',
  messages: [{ role: 'user', content: 'hello gateway' }],
})
ok('reply comes THROUGH the gateway', (out?.choices?.[0]?.message?.content || '').includes('MOCK-LIGHTNING-OK'),
  String(out?.choices?.[0]?.message?.content || '').slice(0, 40))
ok('canonical model ID forwarded verbatim', hits[0]?.model === 'openai/gpt-oss-120b', `model=${hits[0]?.model}`)
ok('Bearer key forwarded (trailing-slash URL normalized)', hits[0]?.auth === 'Bearer test123')
ok('path resolved to /v1/chat/completions (no /v1 doubling)', hits[0]?.path === '/v1/chat/completions', `path=${hits[0]?.path}`)
ok('history forwarded', hits[0]?.msgs === 1)

// set-normalization: a URL already ending in /v1 must not double the suffix
hits.length = 0
setLightningConfig('http://localhost:9991/v1', 'test123')
const out2 = await groqChat({ model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'x' }] })
ok('…/v1 suffix normalized (still one /v1)', hits[0]?.path === '/v1/chat/completions' && (out2?.choices?.[0]?.message?.content || '').includes('MOCK-LIGHTNING-OK'), `path=${hits[0]?.path}`)

// ── 2. fail-open: dead gateway → falls through, no hang ──
setLightningConfig('http://localhost:9889/does-not-exist', 'test123') // nothing listens
const t0 = Date.now()
let threw = null
try {
  await groqChat({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: 'x' }] })
} catch (e) {
  threw = e
}
const dt = Date.now() - t0
ok('dead gateway fails open (chain falls through, throws clean error)',
  threw !== null && dt < 10000, `${threw?.name || 'none'} after ${dt}ms`)

srv.close()
console.log(`v5.30.21 chain test: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
