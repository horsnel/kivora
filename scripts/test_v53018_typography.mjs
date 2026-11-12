// ════════════════════════════════════════════════════════════════════
// test_v53018_typography.mjs — v5.30.18 battery suite
// Covers: splitUserQuote (user-bubble quote split — @-mention context and
// typed quotes render styled, wire format unchanged), ChatClient composer
// font hardening (explicit Inter), user-quote block wiring, and the
// MarkdownRenderer typography contract (prose 1.7, styled blockquote).
// Run: node scripts/test_v53018_typography.mjs
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const ma = await import(new URL('../lib/messageActions.js', import.meta.url).href)

let pass = 0, fail = 0
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}`) }
}
const eq = (name, actual, expected) => {
  const good = JSON.stringify(actual) === JSON.stringify(expected)
  if (good) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`) }
}

console.log('── splitUserQuote ──')
eq('single quote line + body',
  ma.splitUserQuote('> @Kivora: "selectable"\n\nand why exactly?'),
  { quote: '@Kivora: "selectable"', body: 'and why exactly?' })
eq('multi-line quote flattens marker, keeps breaks',
  ma.splitUserQuote('> line one\n> line two\n\nthe question'),
  { quote: 'line one\nline two', body: 'the question' })
eq('quote-only message → empty body',
  ma.splitUserQuote('> just the quote'),
  { quote: 'just the quote', body: '' })
eq('no leading quote → raw passthrough',
  ma.splitUserQuote('plain question'),
  { quote: null, body: 'plain question' })
eq('mid-message quote is NOT split (leading only)',
  ma.splitUserQuote('question\n> not a quote here'),
  { quote: null, body: 'question\n> not a quote here' })
eq('comparison ">5" is not a quote (space required)',
  ma.splitUserQuote('>5 vs 3 which wins'),
  { quote: null, body: '>5 vs 3 which wins' })
eq('bare ">" line not a quote',
  ma.splitUserQuote('>\nsomething'),
  { quote: null, body: '>\nsomething' })
eq('marker stripped exactly once',
  ma.splitUserQuote('> > nested look'),
  { quote: '> nested look', body: '' })
eq('multiple blank lines: only one separator consumed',
  ma.splitUserQuote('> q\n\n\nbody after blanks'),
  { quote: 'q', body: 'body after blanks' })
eq('empty content', ma.splitUserQuote(''), { quote: null, body: '' })
eq('null content', ma.splitUserQuote(null), { quote: null, body: '' })
eq('file-attachment prefix unaffected',
  ma.splitUserQuote('[File: notes.txt]\nsome content'),
  { quote: null, body: '[File: notes.txt]\nsome content' })
ok('round-trip: quote + body reassemble to the wire content', (() => {
  const r = ma.splitUserQuote('> ctx line\n\nmy words')
  return `> ${r.quote}\n\n${r.body}` === '> ctx line\n\nmy words'
})())

console.log('── ChatClient wiring ──')
const cc = readFileSync(root + 'app/chat/ChatClient.jsx', 'utf8')
ok('imports splitUserQuote', cc.includes('splitUserQuote'))
ok('user bubble applies splitUserQuote', cc.includes('splitUserQuote(displayContent)'))
ok('quote block carries data-user-quote', cc.includes('data-user-quote="true"'))
ok('quote block styled with left border (assistant blockquote DNA)',
  cc.includes('border-l-[3px] border-l-white/[0.14]'))
ok('chatTitle derives from the quote-split body (no raw > marker in titles)',
  cc.includes('const { quote, body } = splitUserQuote(raw)') && cc.includes('(body || quote || raw).slice(0, 80)'))
ok('collapsed composer uses explicit Inter (hardened from inherit)',
  /chat-collapsed-input \{[\s\S]{0,700}?font-family: var\(--font-inter\), Inter, system-ui, sans-serif;/.test(cc))
ok('expanded textarea uses explicit Inter (hardened from inherit)',
  /chat-textarea-expanded \{[\s\S]{0,500}?font-family: var\(--font-inter\), Inter, system-ui, sans-serif;/.test(cc))
ok('no font-family:inherit left in composer rules',
  !/chat-(collapsed-input|textarea-expanded) \{[\s\S]{0,400}?font-family: inherit;/.test(cc))

console.log('── MarkdownRenderer typography contract ──')
const md = readFileSync(root + 'components/MarkdownRenderer.jsx', 'utf8')
ok('paragraph line-height stays 1.7 (measured on prod)', md.includes('text-[15px] leading-[1.7]'))
ok('list items stay 1.7', md.includes('leading-[1.7] text-[#d4d4d4] pl-1'))
ok('blockquote styled (left border + tint)', md.includes('border-l-[3px] border-l-[#333]'))
ok('code blocks carry mono font stack', md.includes("font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace]"))

console.log(`\nv5.30.18 suite: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
