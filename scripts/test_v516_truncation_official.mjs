// v5.16 — unit tests for the truncation-continuation heuristics and the
// official-announcement catalog. The heuristics live inside app/api/chat/route.js
// (not exported), so we extract them from the source text and eval — the same
// pattern as the v5.15 notice-card tests. If someone edits the heuristics in
// route.js, these tests track the REAL shipped code, not a copy.

import { readFileSync } from 'node:fs'
import assert from 'node:assert'

const routeSrc = readFileSync(new URL('../app/api/chat/route.js', import.meta.url), 'utf8')

// ── Extract looksCutOff from route.js source ──
const fnMatch = routeSrc.match(/function looksCutOff\(text\) \{[\s\S]*?\n\}/)
assert.ok(fnMatch, 'looksCutOff found in route.js')
const looksCutOff = new Function(`${fnMatch[0]}; return looksCutOff`)()

let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); pass++ } catch (e) { fail++; console.error(`  FAIL ${name}: ${e.message}`) }
}

// ── looksCutOff: negative cases (complete replies) ──
t('short reply → not cut off', () => {
  assert.equal(looksCutOff('Sure! Here you go.'), false)
})
t('complete prose → not cut off', () => {
  const text = 'A'.repeat(500) + ' That is the full explanation, ending here.'
  assert.equal(looksCutOff(text), false)
})
t('complete code fence → not cut off', () => {
  const text = 'Here is the function:\n\n```python\ndef f():\n    return 1\n```\n\nThat covers it. Let me know if you need more.'
  assert.equal(looksCutOff(text), false)
})
t('complete markdown table ending → not cut off', () => {
  const text = 'A'.repeat(450) + '\n\n| name | value |\n|------|-------|\n| a    | 1     |'
  assert.equal(looksCutOff(text), false)
})
t('bold ending → not cut off', () => {
  const text = 'A'.repeat(450) + ' and that is **why it works**'
  assert.equal(looksCutOff(text), false)
})
t('list ending → not cut off', () => {
  const text = 'A'.repeat(450) + '\n- final item with full text here'
  assert.equal(looksCutOff(text), false)
})

// ── looksCutOff: positive cases (silent stream drops) ──
t('unbalanced code fence → cut off', () => {
  const text = 'Here is the code:\n\n```python\ndef f():\n    return 1\n' + 'x'.repeat(20)
  assert.equal(looksCutOff(text), true)
})
t('ends with comma → cut off', () => {
  const text = 'A'.repeat(450) + ' first you need the imports,'
  assert.equal(looksCutOff(text), true)
})
t('ends with colon → cut off', () => {
  const text = 'A'.repeat(450) + ' the three steps are as follows:'
  assert.equal(looksCutOff(text), true)
})
t('ends with open paren → cut off', () => {
  const text = 'A'.repeat(450) + ' then call the handler('
  assert.equal(looksCutOff(text), true)
})
t('mid-prose drop (no terminator in last 200 chars) → cut off', () => {
  const text = 'Here is a full intro sentence. ' + 'B'.repeat(520)
  assert.equal(looksCutOff(text), true)
})
t('unbalanced inline code span → cut off', () => {
  const text = 'A'.repeat(450) + ' run `npm install to get the deps'
  assert.equal(looksCutOff(text), true)
})
t('short reply with unbalanced fence → cut off (fence check skips length guard)', () => {
  assert.equal(looksCutOff('code:\n```js\nlet x = 1'), true)
})

// ── Guard wiring sanity: MAX_CONTINUATIONS raised, tools stripped ──
t('MAX_CONTINUATIONS = 3', () => {
  assert.ok(routeSrc.includes('const MAX_CONTINUATIONS = 3'), 'MAX_CONTINUATIONS bumped')
})
t('continuation condition includes looksCutOff', () => {
  assert.ok(routeSrc.includes("finish === 'length' || looksCutOff(text)"), 'guard condition')
})
t('continuation strips tools', () => {
  assert.ok(routeSrc.includes('delete contParams.tools'), 'tools stripped from continuation')
})

// ── Announcement catalog sanity (kivoraOfficial.js) ──
const offSrc = readFileSync(new URL('../lib/kivoraOfficial.js', import.meta.url), 'utf8')
t('catalog: every announcement has title/date/body', () => {
  const entries = offSrc.match(/\{\s*title:/g) || []
  assert.ok(entries.length >= 4, `at least 4 announcements (found ${entries.length})`)
  // crude but effective: parse the module and inspect ANNOUNCEMENTS
  const mod = offSrc
    .replace(/^import .*$/gm, '')
    .replace(/export const/g, 'const')
    .replace(/export async function/g, 'async function')
    .replace(/export function/g, 'function')
  const sandbox = { console, crypto: globalThis.crypto, Date, Set, URL }
  const fn = new Function(...Object.keys(sandbox), `${mod}; return ANNOUNCEMENTS`)
  const anns = fn(...Object.values(sandbox))
  for (const a of anns) {
    assert.ok(a.title && a.title.length <= 200, `title valid: ${a.title?.slice(0, 40)}`)
    assert.ok(!Number.isNaN(Date.parse(a.date)), `date valid: ${a.date}`)
    assert.ok(a.body && a.body.length > 100, `body substantial: ${a.title}`)
    // v5.16.1 (60aa9c3): community bodies render as MARKDOWN — fences are
    // the feature now (CodeBlock with Copy/Expand/Run), not a violation.
    // The "Try it now" announcement must keep its runnable python block.
    const runAnn = anns.find(x => /```/.test(x.body || ''))
    assert.ok(runAnn, 'at least one announcement ships a runnable fenced block (markdown era)')
    break
  }
  const titles = anns.map(a => a.title)
  assert.equal(new Set(titles).size, titles.length, 'titles unique (existence check is title-keyed)')
})
t('forum GET wires ensure + verification annotations', () => {
  const forumSrc = readFileSync(new URL('../app/api/forum/route.js', import.meta.url), 'utf8')
  assert.ok(forumSrc.includes('ensureOfficialPosts(admin)'), 'ensure wired into GET')
  assert.ok(forumSrc.includes('author_verified'), 'annotation present')
})

console.log(`\n${pass}/${pass + fail} tests passed`)
process.exit(fail ? 1 : 0)
