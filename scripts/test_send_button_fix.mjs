// Regression tests for the onClick={send} root-cause fix (4-round crash saga).
// Verifies at source level that:
//   1. No send button passes `send` directly as a handler reference
//   2. send() coerces non-array retryConvo to null (handler-reference guard)
//   3. The network-error catch feeds the forensics pipeline
//   4. The chat API strictly validates messages as an array
// And behaviorally that the guard predicate handles the exact poison shapes
// seen in production forensics (SyntheticEvent-like objects, cyclic values).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const chatSrc = readFileSync(path.join(root, 'app/chat/ChatClient.jsx'), 'utf8')
const routeSrc = readFileSync(path.join(root, 'app/api/chat/route.js'), 'utf8')

let pass = 0
let fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}`) }
}

console.log('── send button handler wiring ──')
// Strip pure-comment lines first — the guard comment cites onClick={send}
// as documentation, which must not count as a live handler reference.
const chatCode = chatSrc.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const directRefs = (chatCode.match(/onClick=\{send\}/g) || []).length
t('zero onClick={send} handler references remain', directRefs === 0)
const arrowRefs = (chatSrc.match(/onClick=\{\(\) => send\(\)\}/g) || []).length
t('both send buttons use onClick={() => send()} (found ' + arrowRefs + ')', arrowRefs === 2)
// Enter-key paths were always safe — make sure they stayed intact
const enterRefs = (chatSrc.match(/e\.preventDefault\(\); send\(\)/g) || []).length
t('Enter-key send() call sites intact (found ' + enterRefs + ')', enterRefs >= 2)

console.log('── send() handler-reference guard ──')
t('send coerces truthy non-array retryConvo to null',
  chatSrc.includes('if (retryConvo && !Array.isArray(retryConvo)) retryConvo = null'))
t('guard sits before the empty-input early-return (ordering matters)',
  chatSrc.indexOf('!Array.isArray(retryConvo)) retryConvo = null') <
  chatSrc.indexOf('if (!retryConvo && !q && !attachedFile) return'))
t('retry path still passes lastConvoRef (auto-retry preserved)',
  chatSrc.includes('send(lastConvoRef.current)'))

console.log('── behavioral: guard predicate vs production poison shapes ──')
// Re-create the guard exactly as shipped and throw the forensics-reported
// shapes at it: a SyntheticEvent stand-in (own props incl. cyclic nativeEvent),
// a plain object, a string, null/undefined, and the legitimate array form.
const guard = (v) => (v && !Array.isArray(v) ? null : v)
function makeFakeEvent() {
  const ev = { isTrusted: false, type: 'click', nativeEvent: null }
  const native = { isTrusted: true, target: null, currentTarget: null }
  ev.nativeEvent = native
  native.currentTarget = ev // cycle — this is what killed JSON.stringify
  return ev
}
t('SyntheticEvent-like object -> coerced to null', guard(makeFakeEvent()) === null)
t('plain object -> coerced to null', guard({ reply: 'x' }) === null)
t('string (old code would treat as retry) -> coerced to null', guard('hi') === null)
t('null -> untouched (normal send)', guard(null) === null)
t('undefined -> untouched (Enter-key path)', guard(undefined) === undefined)
const convo = [{ role: 'user', content: 'hi' }]
t('legitimate retry array -> passes through unchanged', guard(convo) === convo)

// Prove the original failure mode: stringifying the fake event as part of the
// request body throws (circular), while the guarded array does not.
let stringifyThrew = false
try { JSON.stringify({ messages: makeFakeEvent() }) } catch { stringifyThrew = true }
t('JSON.stringify of event object throws (reproduces "Network error")', stringifyThrew)
let stringifyOk = false
try { JSON.stringify({ messages: guard(makeFakeEvent()) || convo }); stringifyOk = true } catch { stringifyOk = false }
t('JSON.stringify of guarded payload succeeds', stringifyOk)

console.log('── catch-path forensics wiring ──')
t('network-error catch reports to /api/client-errors',
  /catch \(err\) \{[\s\S]*?reportClientError\(err\)[\s\S]*?chat\.error\.network/.test(chatSrc))
t('AbortError (stop button) still skips reporting',
  /name === 'AbortError'/.test(chatSrc) &&
  chatSrc.indexOf("name === 'AbortError'") < chatSrc.indexOf('reportClientError(err)', chatSrc.indexOf('async function send')))

console.log('── API route strict array validation ──')
t('route rejects non-array messages', routeSrc.includes('if (!Array.isArray(messages) || !messages.length)'))
t('loose !messages?.length check removed', !routeSrc.includes('if (!messages?.length)'))
t('400 "messages required" response preserved', routeSrc.includes("json({ error: 'messages required' }, 400)"))

console.log('── no same-class handler-reference bugs on param-taking fns ──')
t('onClick={clearChat} is safe (clearChat takes no params)', /function clearChat\(\)/.test(chatSrc))
t('onClick={removeAttachment} is safe (removeAttachment takes no params)', /function removeAttachment\(\)/.test(chatSrc))

console.log(`\n${pass}/${pass + fail} PASS`)
process.exit(fail > 0 ? 1 : 0)
