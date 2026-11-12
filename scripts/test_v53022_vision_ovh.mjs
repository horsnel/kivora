// ════════════════════════════════════════════════════════════════════
// test_v53022_vision_ovh.mjs — v5.30.22: OVH anonymous vision pre-analysis
// for the research route. Functional tests of lib/vision-ovh.js against a
// mock OVH gateway (OVH_VISION_BASE override) + route wiring source asserts.
// The live anonymous endpoint itself is verified separately by
// scripts/ovh_probe.py (real network call).
// ════════════════════════════════════════════════════════════════════
import http from 'http'
import { readFileSync } from 'fs'

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

// ── mock OVH gateway ──
const hits = []
let mockMode = 'ok' // ok | rate_limited | error
const srv = http.createServer((req, res) => {
  let b = ''
  req.on('data', c => { b += c })
  req.on('end', () => {
    let p = {}
    try { p = JSON.parse(b) } catch {}
    hits.push({
      path: req.url, auth: req.headers['authorization'] || null,
      model: p.model, hasImage: JSON.stringify(p).includes('"image_url"'),
      maxTokens: p.max_tokens,
    })
    if (mockMode === 'rate_limited') {
      res.writeHead(429, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'rate limited' }))
      return
    }
    if (mockMode === 'error') {
      res.writeHead(500)
      res.end('boom')
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: '  A man in a red jacket  standing before\nthe Eiffel Tower. Sign reads "CAFÉ 12".  ' }, finish_reason: 'stop' }],
    }))
  })
})
await new Promise(r => srv.listen(9992, r))

// env override must be set BEFORE the module import (constant is read at import)
process.env.OVH_VISION_BASE = 'http://localhost:9992'
const { describeImageOvh, extractVisionFacts, enrichResearchQueryWithVision } = await import('/home/z/my-project/kivora/lib/vision-ovh.js')

const IMG = 'data:image/png;base64,iVBORw0KGgo='

// ── 1. describeImageOvh happy path ──
const desc = await describeImageOvh(IMG)
ok('description returned', desc === 'A man in a red jacket  standing before\nthe Eiffel Tower. Sign reads "CAFÉ 12".', JSON.stringify(desc?.slice(0, 40)))
ok('anonymous tier: NO Authorization header', hits[0]?.auth === null)
ok('Qwen2.5-VL-72B-Instruct requested', hits[0]?.model === 'Qwen2.5-VL-72B-Instruct')
ok('image_url part present', hits[0]?.hasImage === true)
ok('budget capped (max_tokens 600)', hits[0]?.maxTokens === 600)
ok('posted to /chat/completions', hits[0]?.path === '/chat/completions')

// ── 2. extractVisionFacts compaction ──
const facts = extractVisionFacts(desc)
ok('facts trimmed + whitespace collapsed', facts === 'A man in a red jacket standing before the Eiffel Tower. Sign reads "CAFÉ 12".')
ok('facts capped at 500 chars', extractVisionFacts('x'.repeat(900)).length === 500)
ok('facts empty-safe', extractVisionFacts(null) === '')

// ── 3. enrichResearchQueryWithVision composition ──
const enriched = await enrichResearchQueryWithVision(
  [{ name: 'photo.png', type: 'image/png', content: IMG }],
  'who is this person?'
)
ok('query enriched with [Image analysis] seed', enriched.startsWith('who is this person?\n\n[Image analysis] A man in a red jacket'))
ok('original query preserved verbatim', enriched.startsWith('who is this person?'))

// ── 4. fail-open paths ──
ok('no image → passthrough untouched', await enrichResearchQueryWithVision([{ type: 'text/plain', content: 'hello' }], 'q') === 'q')
ok('null/absent files → passthrough', await enrichResearchQueryWithVision([], 'q') === 'q')
mockMode = 'rate_limited'
const rl = await enrichResearchQueryWithVision([{ content: IMG }], 'q')
ok('429 → fail open (query untouched)', rl === 'q')
mockMode = 'error'
const er = await enrichResearchQueryWithVision([{ content: IMG }], 'q')
ok('500 → fail open (query untouched)', er === 'q')
mockMode = 'ok'
ok('non-image content → passthrough', await enrichResearchQueryWithVision([{ content: 'plain text file' }], 'q') === 'q')
ok('malformed data URL → passthrough', await enrichResearchQueryWithVision([{ content: 'data:image/' }], 'q') === 'q')
srv.close()

// ── 5. route wiring source asserts (real v5.30.21 research route) ──
const route = readFileSync('/home/z/my-project/kivora/app/api/research/route.js', 'utf8')
const lib = readFileSync('/home/z/my-project/kivora/lib/vision-ovh.js', 'utf8')
ok('route imports describeImageOvh', route.includes("import { describeImageOvh } from '@/lib/vision-ovh'"))
const fnStart = route.indexOf('async function analyzeImageAttachments')
const ovhCall = route.indexOf('await describeImageOvh(', fnStart)
const chainCall = route.indexOf('setGeminiApiKey(geminiKey)', fnStart)
ok('OVH tried FIRST inside analyzeImageAttachments', ovhCall > -1 && chainCall > -1 && ovhCall < chainCall)
ok('existing qwen3.8 chain kept as fallback', route.includes('model: VISION_MODEL') && route.includes("reasoning_effort: 'none'"))
ok('hard 20s cap preserved over BOTH attempts', route.includes("reject(new Error('vision pre-analysis timeout')), 20000"))
ok('worker [IMAGE ANALYSIS] wrapper intact', route.includes('[IMAGE ANALYSIS — machine-generated brief'))
ok('OVH success observable (log marker)', route.includes('OVH vision brief used'))
ok('OVH ask gets the full brief budget (900 tokens)', route.includes('{ maxTokens: 900 }'))
ok('lib has NO groq fallback CODE (user decision)', !lib.includes('api.groq.com') && !lib.includes('GROQ_API_KEY'))
ok('lib sends no auth header (anonymous tier)', lib.includes('No Authorization header — anonymous tier'))

console.log(`v5.30.22 suite: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
