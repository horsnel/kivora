// ════════════════════════════════════════════════════════════════════
// test_v53016_action_bar.mjs — v5.30.16 battery suite
// Covers: lib/messageActions.js pure logic (quote source, quote text,
// workspace filename, rerun truncation), the globals.css font-var fix
// (mono chain now resolves at body), ChatClient wiring (title, bar,
// handlers), icon exports, i18n completeness ×4 locales.
// Run: node scripts/test_v53016_action_bar.mjs
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
  const good = actual === expected
  if (good) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`) }
}

console.log('── pickQuoteSource ──')
eq('selection wins over content',
  ma.pickQuoteSource('  highlighted phrase  ', 'full message body'), 'highlighted phrase')
eq('fallback strips markdown',
  ma.pickQuoteSource('', '**bold** intro with `code`'), 'bold intro with code')
eq('fallback trims empty selection whitespace',
  ma.pickQuoteSource('   \n\t ', 'real content'), 'real content')
eq('empty both → empty string', ma.pickQuoteSource('', ''), '')
eq('caps long fallback at 600 + ellipsis',
  ma.pickQuoteSource('', 'x'.repeat(800)), 'x'.repeat(600) + '…')
eq('caps long selection too',
  ma.pickQuoteSource('y'.repeat(700), 'ignored'), 'y'.repeat(600) + '…')
eq('null/undefined selection + content → empty', ma.pickQuoteSource(null, undefined), '')

console.log('── buildQuoteText ──')
eq('single line', ma.buildQuoteText('hello'), '> hello')
eq('multiline prefixes every line', ma.buildQuoteText('one\ntwo\nthree'), '> one\n> two\n> three')
eq('empty → empty-ish', ma.buildQuoteText(''), '> ')
eq('empty string → "> "', typeof ma.buildQuoteText(''), 'string')

console.log('── workspaceFilename ──')
eq('fixed date → exact name',
  ma.workspaceFilename(new Date(2026, 10, 12, 14, 32, 7)),
  'ai-response-2026-11-12-143207.md')
eq('zero padding month/day/hour/min/sec',
  ma.workspaceFilename(new Date(2026, 0, 3, 5, 4, 9)),
  'ai-response-2026-01-03-050409.md')
ok('markdown extension', ma.workspaceFilename(new Date()).endsWith('.md'))
ok('notes/ prefix chosen by caller (path shape)', ma.workspaceFilename(new Date()).startsWith('ai-response-'))

console.log('── rerunTruncation ──')
const convo = [
  { role: 'user', content: 'q1' },
  { role: 'assistant', content: 'a1' },
  { role: 'user', content: 'q2' },
  { role: 'assistant', content: 'a2' },
]
eq('mid-conversation rerun keeps [user, assistant, user]',
  JSON.stringify(ma.rerunTruncation(convo, 3)), JSON.stringify([convo[0], convo[1], convo[2]]))
eq('last-message rerun keeps [user, assistant, user]',
  JSON.stringify(ma.rerunTruncation(convo, 3)), JSON.stringify([convo[0], convo[1], convo[2]]))
ok('rerun of index 1 ends on user q1',
  ma.rerunTruncation(convo, 1)[ma.rerunTruncation(convo, 1).length - 1].role === 'user')
eq('index 0 → null (no user msg before it)', ma.rerunTruncation(convo, 0), null)
eq('out of bounds → null', ma.rerunTruncation(convo, 4), null)
eq('negative → null', ma.rerunTruncation(convo, -1), null)
eq('non-integer → null', ma.rerunTruncation(convo, 1.5), null)
eq('non-array → null', ma.rerunTruncation('nope', 1), null)
eq('empty array → null', ma.rerunTruncation([], 1), null)
eq('truncated not ending on user → null',
  ma.rerunTruncation([{ role: 'assistant', content: 'a' }, { role: 'assistant', content: 'b' }], 1), null)

console.log('── globals.css font-var fix ──')
const css = readFileSync(root + 'app/globals.css', 'utf8')
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('body {'))
ok(':root no longer defines --font-sans', !rootBlock.includes('--font-sans:'))
ok(':root no longer defines --font-mono', !rootBlock.includes('--font-mono:'))
const bodyBlock = css.slice(css.indexOf('body {'), css.indexOf('code, pre, kbd'))
ok('body defines --font-sans from --font-inter', bodyBlock.includes('--font-sans: var(--font-inter)'))
ok('body defines --font-mono from --font-jetbrains', bodyBlock.includes('--font-mono: var(--font-jetbrains)'))
ok('code/pre rule still consumes var(--font-mono)', /code, pre, kbd, \.font-mono \{[^}]*var\(--font-mono\)/.test(css))
ok('body font-family still var(--font-sans)', /body \{[^}]*font-family: var\(--font-sans\)/.test(css))

console.log('── ChatClient wiring ──')
const src = readFileSync(root + 'app/chat/ChatClient.jsx', 'utf8')
ok('headerTitle derives from chatTitle with synthetic session',
  src.includes('chatTitle(activeSession || { id: sessionId || \'draft\', messages })'))
ok('title hidden on empty fresh chats', src.includes("(sessionId || messages.length > 0)"))
ok('header renders data-chat-title h1', src.includes('data-chat-title="true"'))
ok('header title is rename-aware via chatTitle (sessionMeta lookup inside chatTitle)',
  src.includes("const metaTitle = sessionMeta[session?.id]?.title"))
ok('action bar renders for assistant messages only',
  src.includes("msg.role === 'assistant' && !notice && !(msg.isImage && msg.imageData)"))
ok('bar hidden while streaming last reply',
  src.includes('String(msg.content || \'\').trim() && !(streaming && i === messages.length - 1)'))
for (const ab of ['copy', 'quote', 'save', 'up', 'down', 'rerun']) {
  ok(`bar button data-ab="${ab}" present`, src.includes(`data-ab="${ab}"`))
}
ok('copy reuses copy(content, i)', src.includes('onClick={() => copy(msg.content, i)}'))
ok('copy icon swaps to check on copiedIndex', src.includes('{copiedIndex === i ? <IconCheck size={14} /> : <IconCopy size={14} />}'))
ok('quote keeps selection via mousedown preventDefault', /data-ab="quote"[\s\S]{0,120}onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/.test(src))
ok('save posts notes/ workspace filename via authFetch',
  src.includes('path: `notes/${workspaceFilename()}`') && src.includes("authFetch('/api/vfs', {"))
ok('save gate: guest gets sign-in toast', src.includes("if (!user) {\n      showVoiceToast('info', t('chat.actions.signin_save')"))
ok('save disabled while saving', src.includes('disabled={saveState[i] === \'saving\'}'))
ok('save error surfaces toast', src.includes("t('chat.actions.save_failed')"))
ok('thumbs toggle with aria-pressed', src.includes('aria-pressed={msgFeedback[i] === \'up\'}') && src.includes('aria-pressed={msgFeedback[i] === \'down\'}'))
ok('rerun disabled while loading', src.includes('disabled={loading}'))
ok('rerun goes through rerunTruncation guard', src.includes('const truncated = rerunTruncation(messages, i)') && src.includes('if (!truncated) return'))
ok('rerun mirrors lastConvoRef (auto-retry contract intact)',
  /rerunTruncation\(messages, i\)[\s\S]{0,200}lastConvoRef\.current = truncated[\s\S]{0,80}send\(truncated\)/.test(src))
ok('handlers imported from lib/messageActions',
  src.includes("import { pickQuoteSource, buildQuoteText, workspaceFilename, rerunTruncation } from '@/lib/messageActions'"))
ok('new icons imported', src.includes('IconThumbsUp, IconThumbsDown, IconRefresh, IconBookmark, IconBookmarkFill, IconQuote'))
ok('non-last rows hover-reveal on desktop only',
  src.includes('opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100'))

console.log('── icon exports ──')
const icons = readFileSync(root + 'components/Icons.jsx', 'utf8')
for (const name of ['IconThumbsUp', 'IconThumbsDown', 'IconRefresh', 'IconBookmark', 'IconBookmarkFill', 'IconQuote']) {
  ok(`${name} exported`, icons.includes(`export function ${name}(`))
}

console.log('── i18n completeness ×4 ──')
const KEYS = ['copy', 'quote', 'save', 'saved', 'save_failed', 'signin_save', 'up', 'down', 'rerun']
for (const loc of ['en', 'fr', 'sw', 'yo']) {
  const data = JSON.parse(readFileSync(root + `lib/i18n/${loc}.json`, 'utf8'))
  const missing = KEYS.filter(k => !data[`chat.actions.${k}`])
  ok(`${loc}.json carries all 9 chat.actions.* keys`, missing.length === 0, missing.join(','))
}
const yo = JSON.parse(readFileSync(root + 'lib/i18n/yo.json', 'utf8'))
ok('yo values are non-ASCII Yoruba (diacritics survived)', /[ọẹṣ]/u.test(yo['chat.actions.rerun'] + yo['chat.actions.save']))
const en = JSON.parse(readFileSync(root + 'lib/i18n/en.json', 'utf8'))
eq('en rerun label', en['chat.actions.rerun'], 'Regenerate')

console.log(`\n${pass}/${pass + fail} PASS`)
process.exit(fail > 0 ? 1 : 0)
