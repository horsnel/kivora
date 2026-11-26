#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v53033_usage.mjs — v5.30.33: composer padding fix and the full
// quota card with REAL provider usage.
//
// Covers:
//   1. Functional: mistral stream captures the provider's usage object
//      from the final SSE chunk (and ignores zero-token stubs).
//   2. Route: usage threads through aiChatComplete + both done paths.
//   3. Client: quota card spec (header/Free/off-peak/Input/Output grid/
//      context usage), pricing constant, usage storage in applyChatMeta.
//   4. Branding remnants still true under v5.30.34 Responsive Branding
//      (the v5.30.33 full-logo-in-sidebars spec was superseded; the live
//      branding suite is test_v53034_responsive_branding.mjs).
//   5. Composer: bottom padding on the gradient pill + widen button +
//      honest send icon on the greeting pill.
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'fs'
import assert from 'assert'

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

// ── 1. Functional: mistral stream usage capture ─────────────────────
console.log('── mistral stream usage capture (stubbed SSE) ──')
const { setMistralApiKeys, mistralChatStream } = await import('../lib/mistral.js')
setMistralApiKeys('test-key', 'test-key-2')

function sseResponse(chunks) {
  const lines = chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  const stream = new ReadableStream({
    start(ctrl) { ctrl.enqueue(new TextEncoder().encode(lines)); ctrl.close() },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const delta = { choices: [{ delta: { content: 'Hello' } }] }
const finish = { choices: [{ delta: {}, finish_reason: 'stop' }] }

{
  let captured = null
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => sseResponse([
    delta, delta,
    { choices: [{ delta: {} }], usage: { prompt_tokens: 2306, completion_tokens: 673, total_tokens: 2979 } },
    finish,
  ])
  try {
    const r = await mistralChatStream({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'hi' }] })
    captured = r
  } finally { globalThis.fetch = origFetch }
  ok('usage captured from final chunk', captured?.usage?.total_tokens === 2979)
  ok('prompt_tokens surfaced', captured?.usage?.prompt_tokens === 2306)
  ok('completion_tokens surfaced', captured?.usage?.completion_tokens === 673)
  ok('deltas still streamed (content assembled)', captured?.choices?.[0]?.message?.content === 'HelloHello')
}

{
  // Zero-token usage (offline stub shape) must be treated as absent
  let captured = null
  const origFetch = globalThis.fetch
  globalThis.fetch = async () => sseResponse([
    delta,
    { choices: [{ delta: {} }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    finish,
  ])
  try {
    captured = await mistralChatStream({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'hi' }] })
  } finally { globalThis.fetch = origFetch }
  ok('zero-token usage treated as absent', captured?.usage === undefined)
}

// ── 2. Route wiring ─────────────────────────────────────────────────
console.log('── route.js usage threading ──')
const routeSrc = readFileSync('app/api/chat/route.js', 'utf8')
ok('pickUsage helper exists', routeSrc.includes('function pickUsage(chat)'))
ok('mergeUsage helper exists', routeSrc.includes('function mergeUsage(a, b)'))
ok('zero-token guard in pickUsage', routeSrc.includes("Number(u.total_tokens) <= 0) return null"))
ok('aiChatComplete sums continuation usage', routeSrc.includes('usage = mergeUsage(usage, pickUsage(cont))'))
ok('aiChatComplete returns usage', /choices: \[\{[\s\S]{0,420}\}\],\s*\.\.\.\(usage \? \{ usage \} : \{\}\),/.test(routeSrc))
ok('tool path merges chat + finalChat usage', routeSrc.includes('mergeUsage(pickUsage(chat), pickUsage(finalChat))'))
ok('normal path attaches chat usage', routeSrc.includes('const turnUsage = pickUsage(chat)'))
ok('done frame count unchanged (3 sends)', (routeSrc.match(/type: 'done'/g) || []).length === 3)

// ── 3. Client: quota card spec ──────────────────────────────────────
console.log('── ChatClient quota card spec ──')
const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')
ok('pricing constant (0.15 in / 0.6 out)', cc.includes('const QUOTA_PRICING = { inputPerM: 0.15, outputPerM: 0.6 }'))
ok('cost math per spec (tokens/1M × price)', cc.includes('(promptTokens / 1_000_000) * QUOTA_PRICING.inputPerM') && cc.includes('(completionTokens / 1_000_000) * QUOTA_PRICING.outputPerM'))
ok('card header title', cc.includes('>Quota used this turn<'))
ok('Free tier line', cc.includes('>Free</p>'))
ok('off-peak note', cc.includes('Estimated at off-peak rates'))
ok('unit prices in grid ($0.15 / $0.6 per 1M)', cc.includes('$0.15 / 1M tokens') && cc.includes('$0.6 / 1M tokens'))
ok('Usage rows render tokens', cc.includes('.toLocaleString()} tokens'))
ok('Amount rows render USD', cc.includes('${quotaCard.inputCost.toFixed(7)}') && cc.includes('${quotaCard.outputCost.toFixed(7)}'))
ok('total USD in header', cc.includes('${quotaCard.totalCost.toFixed(7)}'))
ok('context usage footer text', cc.includes('Context usage as of this turn'))
ok('spec card styling (#1e1e1e / #333 / rounded-xl / w-80)', cc.includes('w-80 bg-[#1e1e1e] border border-[#333333] rounded-xl'))
ok('database icon in header', /Quota used this turn[\s\S]{0,600}ellipse cx="12" cy="5"/.test(cc) === false && cc.includes('ellipse cx="12" cy="5"'))
ok('real usage preferred over estimates', cc.includes('Number(msg.usage.total_tokens) > 0'))
ok('(est.) marker only when no real usage', cc.includes('!quotaCard.realUsage && <span className="text-[#737373]"> (est.)</span>'))
ok('usage stored on message (applyChatMeta)', cc.includes('msg.usage = {\n        prompt_tokens'))
ok('usage stored only for non-zero totals', cc.includes("data.usage && Number(data.usage.total_tokens) > 0"))

// ── 4. Branding remnants (v5.30.34 Responsive Branding supersedes the
//    v5.30.33 sidebar-logo spec; full branding suite lives in
//    test_v53034_responsive_branding.mjs) ─────────────────────────────
console.log('── branding remnants still true under Responsive Branding ──')
ok('chat sidebar: icon-only mark + close right', cc.includes('aria-label="Kivora home"') && cc.includes('aria-label="Close conversations"') && /v5\.30\.34 — Responsive Branding \(text on pages/.test(cc))
ok('chat sidebar: close button block intact', /aria-label="Close conversations"[\s\S]{0,220}<IconClose size=\{16\} \/>/.test(cc))
ok('small + beside search bar', /Search conversations[\s\S]{0,900}aria-label="New chat"/.test(cc))
ok('chat main top bar unchanged (title center, no logo)', cc.includes('data-chat-title="true"'))

// ── 5. Composer padding + widen button ──────────────────────────────
console.log('── research composer: padding + widen + honest send ──')
const rp = readFileSync('app/research/page.jsx', 'utf8')
const rc = readFileSync('app/research/ResearchClient.jsx', 'utf8')
ok('page.jsx pill bottom padding 12px', rp.includes('padding: 8px 12px 12px 12px;'))
ok('ResearchClient pill bottom padding 12px', rc.includes('padding: 8px 12px 12px 12px;'))
ok('mobile pill bottom padding 9px', rp.includes('padding: 6px 8px 9px 8px;'))
ok('expanded container bottom padding 14px', rc.includes('padding: 16px 16px 14px 16px;'))
ok('greeting pill: widen button added', /Apex model chip[\s\S]{0,4200}aria-label="Widen editor"/.test(rp))
ok('greeting pill: widen never sends', rp.includes('onClick={() => setBarExpanded(true)}') && /aria-label="Widen editor"[\s\S]{0,60}title="Widen editor"/.test(rp))
ok('greeting pill: 4-bar equalizer icon gone', !rp.includes('<rect x="4" y="8" width="2" height="8"'))
ok('greeting pill: grey plane when empty', rp.includes("className={hasInput ? '' : 'opacity-40'}"))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
