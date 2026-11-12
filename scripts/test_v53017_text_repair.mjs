// ════════════════════════════════════════════════════════════════════
// test_v53017_text_repair.mjs — v5.30.17 battery suite
// Covers: lib/textRepair.js (fence self-heal, failure-notice detection,
// conversation cleaning — the janitor's exact rules), messageActions
// reply-reference helpers (@-mention chip), ChatClient wiring (isError
// flags, tap isolation, feedback persistence, title width, self-healing
// render), janitor + workflow + migration presence, i18n ×4.
// Run: node scripts/test_v53017_text_repair.mjs
// ════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const tr = await import(new URL('../lib/textRepair.js', import.meta.url).href)
const ma = await import(new URL('../lib/messageActions.js', import.meta.url).href)

let pass = 0, fail = 0
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}`) }
}
const eq = (name, actual, expected) => {
  const good = actual === expected
  if (good) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`) }
}
const deepEq = (name, actual, expected) => {
  const good = JSON.stringify(actual) === JSON.stringify(expected)
  if (good) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`) }
}

console.log('── hasUnclosedFence ──')
eq('no backticks → false', tr.hasUnclosedFence('plain text'), false)
eq('inline code only → false', tr.hasUnclosedFence('use `fmt.Println` here'), false)
eq('single fence → true', tr.hasUnclosedFence('intro\n```js\nconst x = 1'), true)
eq('two fences → false', tr.hasUnclosedFence('```js\nx\n```\ndone'), false)
eq('three fences → true', tr.hasUnclosedFence('```js\nx\n```\nmid\n```py\ny'), true)
eq('fence with language marker → true', tr.hasUnclosedFence('```python\nprint(1)'), true)
eq('empty string → false', tr.hasUnclosedFence(''), false)
eq('null → false', tr.hasUnclosedFence(null), false)

console.log('── closeUnclosedFences ──')
const balanced = '```js\nx\n```\nafter'
eq('balanced → unchanged', tr.closeUnclosedFences(balanced), balanced)
eq('no backticks → unchanged', tr.closeUnclosedFences('plain'), 'plain')
eq('unclosed gets closing fence', tr.closeUnclosedFences('```js\nconst x = 1'), '```js\nconst x = 1\n```')
eq('trailing newline → fence without blank', tr.closeUnclosedFences('```js\nx\n'), '```js\nx\n```')
eq('fence with lang marker closed', tr.closeUnclosedFences('```python\nprint(1)'), '```python\nprint(1)\n```')
eq('no prose loss — body kept', tr.closeUnclosedFences('look:\n```html\n<p>hi</p>'), 'look:\n```html\n<p>hi</p>\n```')
eq('null → empty string', tr.closeUnclosedFences(null), '')

console.log('── isFailureNotice ──')
eq('resume stall notice', tr.isFailureNotice('The response stopped progressing. Please resend your message to try again.'), true)
eq('interrupted-before-content notice', tr.isFailureNotice('The reply was interrupted before any content arrived — please send your message again.'), true)
eq('empty-reply fallback (straight apostrophe)', tr.isFailureNotice("I couldn't generate a response for that. Please try sending it again."), true)
eq('empty-reply fallback (curly apostrophe)', tr.isFailureNotice('I couldn’t generate a response for that. Please try sending it again.'), true)
eq('network error card', tr.isFailureNotice('Network error. Please try again.'), true)
eq('short generic failure', tr.isFailureNotice('Something went wrong'), true)
ok('legit long reply starting with the same words → kept',
  !tr.isFailureNotice('Something went wrong with your old CSS. Here is the corrected stylesheet: ' + 'x'.repeat(210)))
eq('normal assistant content → false', tr.isFailureNotice('Here is how you do it: first install the package.'), false)
eq('empty → false', tr.isFailureNotice(''), false)
eq('whitespace → false', tr.isFailureNotice('   '), false)
eq('null → false', tr.isFailureNotice(null), false)

console.log('── cleanSessionMessages (janitor rules) ──')
const notice = { role: 'assistant', content: 'The response stopped progressing. Please resend your message to try again.' }
const user1 = { role: 'user', content: 'why did it stop' }
const good = { role: 'assistant', content: 'All good here.' }
const partial = { role: 'assistant', content: 'step one:\n```bash\nnpm ci', meta: 7 }
const r1 = tr.cleanSessionMessages([user1, notice, good])
deepEq('drops failure notice between healthy turns', r1.messages, [user1, good])
eq('removed counter', r1.removed, 1)
eq('repaired counter', r1.repaired, 0)
const r2 = tr.cleanSessionMessages([user1, { role: 'assistant', content: '   ' }])
deepEq('drops empty assistant bubble', r2.messages, [user1])
eq('removed counter (empty bubble)', r2.removed, 1)
const r3 = tr.cleanSessionMessages([user1, partial])
deepEq('repairs unclosed fence, keeps other props', r3.messages[1],
  { role: 'assistant', content: 'step one:\n```bash\nnpm ci\n```', meta: 7 })
eq('repaired counter', r3.repaired, 1)
eq('removed counter (repair-only pass)', r3.removed, 0)
const userFence = { role: 'user', content: 'my snippet:\n```js\nconst a = 1' }
const r4 = tr.cleanSessionMessages([userFence, good])
eq('user messages never modified', r4.messages[0], userFence)
const r5 = tr.cleanSessionMessages('not an array')
eq('non-array passthrough', r5.messages, 'not an array')
eq('non-array zero counters', r5.removed === 0 && r5.repaired === 0, true)
const healthy = [user1, good, { role: 'user', content: 'q2' }, { role: 'assistant', content: 'a2' }]
const r6 = tr.cleanSessionMessages(healthy)
deepEq('healthy conversation untouched (same items)', r6.messages, healthy)
eq('healthy conversation zero counters', r6.removed === 0 && r6.repaired === 0, true)
const r7 = tr.cleanSessionMessages([user1, notice, { role: 'user', content: 'retry' }])
ok('notice removal may leave consecutive user turns (re-ask shape)', r7.messages[1]?.role === 'user')

console.log('── sessionRepairSummary ──')
eq('nothing done → null', tr.sessionRepairSummary('sid', { removed: 0, repaired: 0 }), null)
eq('drops only', tr.sessionRepairSummary('sid', { removed: 2, repaired: 0 }), 'sid: 2 dropped')
eq('repairs only', tr.sessionRepairSummary('sid', { removed: 0, repaired: 3 }), 'sid: 3 fence-repaired')
eq('both', tr.sessionRepairSummary('sid', { removed: 1, repaired: 2 }), 'sid: 1 dropped, 2 fence-repaired')

console.log('── messageActions reply-reference helpers ──')
eq('mentionLabel assistant → @Kivora', ma.mentionLabel('assistant'), '@Kivora')
eq('mentionLabel user → @You', ma.mentionLabel('user'), '@You')
eq('mentionLabel unknown → @Kivora', ma.mentionLabel(undefined), '@Kivora')
eq('replyChipExcerpt single line', ma.replyChipExcerpt('a quoted phrase'), 'a quoted phrase')
eq('replyChipExcerpt flattens newlines', ma.replyChipExcerpt('one\ntwo\n  three  '), 'one two three')
eq('replyChipExcerpt caps at 96 + ellipsis',
  ma.replyChipExcerpt('q'.repeat(120)), 'q'.repeat(96) + '…')
eq('replyChipExcerpt empty → empty', ma.replyChipExcerpt(''), '')
eq('replyChipExcerpt null → empty', ma.replyChipExcerpt(null), '')
eq('buildReplyContext assistant', ma.buildReplyContext('what is this', 'assistant'), '> @Kivora: "what is this"')
eq('buildReplyContext user', ma.buildReplyContext('my question', 'user'), '> @You: "my question"')
eq('buildReplyContext caps excerpt at 200',
  ma.buildReplyContext('z'.repeat(300), 'assistant'), `> @Kivora: "${'z'.repeat(200)}…"`)
eq('buildReplyContext flattens newlines',
  ma.buildReplyContext('line one\nline two', 'assistant'), '> @Kivora: "line one line two"')
eq('buildReplyContext empty → empty', ma.buildReplyContext('', 'assistant'), '')
eq('buildReplyContext whitespace → empty', ma.buildReplyContext('  \n ', 'user'), '')

console.log('── messageActions regressions (v5.30.16 surface intact) ──')
eq('pickQuoteSource: selection still wins', ma.pickQuoteSource('selected text', 'full body'), 'selected text')
const convo = [
  { role: 'user', content: 'q1' },
  { role: 'assistant', content: 'a1' },
  { role: 'user', content: 'q2' },
  { role: 'assistant', content: 'a2' },
]
deepEq('rerunTruncation still truncates to user turn', ma.rerunTruncation(convo, 3), convo.slice(0, 3))
eq('rerunTruncation still rejects bad index', ma.rerunTruncation(convo, 0), null)
eq('workspaceFilename still stable',
  ma.workspaceFilename(new Date(2026, 10, 12, 14, 32, 7)), 'ai-response-2026-11-12-143207.md')

console.log('── ChatClient wiring (source-level) ──')
const cc = readFileSync(root + 'app/chat/ChatClient.jsx', 'utf8')
ok('imports replyChipExcerpt / buildReplyContext / mentionLabel',
  cc.includes('replyChipExcerpt') && cc.includes('buildReplyContext') && cc.includes('mentionLabel'))
ok('imports the self-heal helper', cc.includes("from '@/lib/textRepair'"))
ok('bar condition excludes error notices', cc.includes("!notice && !msg.isError"))
ok('bar container isolates taps from the long-press handler',
  cc.includes('onPointerDown={(e) => e.stopPropagation()}') && cc.includes('onClick={(e) => e.stopPropagation()}'))
ok('bar buttons carry expanded hit areas + touch-action',
  cc.includes("before:absolute before:-inset-1.5") && cc.includes('[touch-action:manipulation]'))
ok('quote button passes the message index', cc.includes('quoteReply(msg.content, i)'))
ok('send() prepends the @-mention context', cc.includes('buildReplyContext(replyRef.excerpt'))
ok('chip cleared on send / clearChat / loadSession',
  (cc.match(/setReplyRef\(null\)/g) || []).length >= 3)
ok('thumbs persist through persistSessionMeta', cc.includes('persistSessionMeta(sessionId, { feedback: next })'))
ok('loadSession hydrates feedback via normalizeFeedback', cc.includes('normalizeFeedback(localMeta.feedback ?? session.feedback'))
ok('history select includes feedback with graceful fallback',
  cc.includes("'id, messages, updated_at, title, pinned, feedback'") && cc.includes("cols.replace(', feedback', '')"))
ok('chatTitle derives up to 80 chars', cc.includes('.slice(0, 80)'))
ok('AssistantContent renders self-healed content', cc.includes('closeUnclosedFences(content)'))
ok('reply-reference chip renders above composer', cc.includes('data-reply-chip="true"'))
const errFlagCount = (cc.match(/assistantMsg\.isError = true/g) || []).length
ok(`all error branches flag isError (found ${errFlagCount}, need ≥4)`, errFlagCount >= 4)

console.log('── Janitor + migration + workflow presence ──')
ok('migration SQL exists with feedback column',
  existsSync(root + 'chat-message-feedback-migration.sql')
  && readFileSync(root + 'chat-message-feedback-migration.sql', 'utf8').includes('add column if not exists feedback jsonb'))
ok('janitor script exists and imports the shared repair rules',
  existsSync(root + 'scripts/maintenance/janitor.mjs')
  && readFileSync(root + 'scripts/maintenance/janitor.mjs', 'utf8').includes('from \'../../lib/textRepair.js\''))
ok('janitor also closes fences + drops notices (same rules as lib)',
  readFileSync(root + 'scripts/maintenance/janitor.mjs', 'utf8').includes('closeUnclosedFences')
  && readFileSync(root + 'scripts/maintenance/janitor.mjs', 'utf8').includes('isFailureNotice'))
const wf = readFileSync(root + '.github/workflows/janitor.yml', 'utf8')
ok('nightly workflow exists with daily cron + service-key secrets',
  wf.includes('cron: \'17 2 * * *\'') && wf.includes('SUPABASE_SERVICE_KEY') && wf.includes('workflow_dispatch'))

console.log('── i18n ×4 locales ──')
for (const loc of ['en', 'fr', 'sw', 'yo']) {
  const d = JSON.parse(readFileSync(root + `lib/i18n/${loc}.json`, 'utf8'))
  ok(`${loc}: chat.reply.mention + chat.reply.cancel present`,
    typeof d['chat.reply.mention'] === 'string' && typeof d['chat.reply.cancel'] === 'string')
}
const en = JSON.parse(readFileSync(root + 'lib/i18n/en.json', 'utf8'))
eq('en mention copy', en['chat.reply.mention'], 'Replying to')
const yo = JSON.parse(readFileSync(root + 'lib/i18n/yo.json', 'utf8'))
ok('yoruba diacritics intact', yo['chat.reply.mention'].includes('Ìdáhùn'))

console.log('── janitor determinism vs lib (lockstep check) ──')
const janSrc = readFileSync(root + 'scripts/maintenance/janitor.mjs', 'utf8')
ok('janitor never touches user messages (skip guard)',
  janSrc.includes("m.role !== 'assistant'"))
ok('janitor caps writes per run', janSrc.includes('MAX_SESSION_WRITES'))
ok('janitor supports DRY_RUN', janSrc.includes('DRY_RUN'))
ok('janitor purges stale chat_generations', janSrc.includes('chat_generations'))

console.log(`\nv5.30.17 suite: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
