// v5.30.15 — action-tag parsing / recovery / card tests
// Covers lib/actionTags.js (parseActionSegments + streaming guard + fence
// protection), lib/toolCallRecovery.js (recoverToolCallFromText extended to
// pseudo-XML wrappers, stripActionTagToolBlocks), and a renderToString check
// of components/chat/AIActionCard.jsx via an esbuild harness.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

let pass = 0, fail = 0
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name) }
  else { fail++; console.log('  FAIL', name, extra) }
}

const { parseActionSegments, findActionBlocks, unclosedActionTagStart } = await import(
  new URL('../lib/actionTags.js', import.meta.url).href
)
const { recoverToolCallFromText, stripActionTagToolBlocks } = await import(
  new URL('../lib/toolCallRecovery.js', import.meta.url).href
)

const KNOWN = new Set(['sandbox_git', 'web_search', 'sandbox_file'])

console.log('── 1. parseActionSegments — the user-reported leak format ──')
const leak = `<file type="json" title="Cloning Appwrite Repo"> {"name": "sandbox_git", "arguments": {"url": "https://github.com/appwrite/appwrite", "branch": "main", "target_dir": "appwrite"}} </file>`
let segs = parseActionSegments(leak)
t('single segment when only the tag', segs.length === 1 && segs[0].type === 'action', JSON.stringify(segs.map(s => s.type)))
t('toolName extracted', segs[0].toolName === 'sandbox_git')
t('title extracted from attrs', segs[0].title === 'Cloning Appwrite Repo')
t('arguments object passed through', segs[0].args?.url === 'https://github.com/appwrite/appwrite' && segs[0].args?.branch === 'main')
t('valid=true for known-shape payload', segs[0].valid === true)

console.log('── 2. prose around the tag is preserved byte-exact ──')
const mixed = `Let me clone that for you.\n\n${leak}\n\nDone in a moment.`
segs = parseActionSegments(mixed)
t('3 segments (text/action/text)', segs.length === 3 && segs[1].type === 'action')
t('leading prose intact', segs[0].text === 'Let me clone that for you.\n\n')
t('trailing prose intact', segs[2].text === '\n\nDone in a moment.')

console.log('── 3. fenced code is NEVER converted ──')
const fenced = `Here is the format the bug produced:\n\n\`\`\`\n${leak}\n\`\`\`\nThat raw tag leaked into the bubble.`
segs = parseActionSegments(fenced)
t('tag inside a fence stays text', segs.length === 1 && segs[0].type === 'text')
t('fence bytes untouched', segs[0].text.includes('<file type="json"'))

console.log('── 4. tag whose body wraps the JSON in a fence ──')
const fencedBody = `<file type="json" title="X">\n\`\`\`json\n{"name": "web_search", "arguments": {"query": "kivora"}}\n\`\`\`\n</file>`
segs = parseActionSegments(fencedBody)
t('fenced JSON inside tag → action', segs.length === 1 && segs[0].type === 'action' && segs[0].toolName === 'web_search')

console.log('── 5. non-JSON and legacy artifact bodies stay text ──')
const malformed = `<file type="json" title="Broken"> {"name": "sandbox_git", "arguments": {oops} </file>`
segs = parseActionSegments(malformed)
t('malformed JSON stays raw text', segs.length === 1 && segs[0].type === 'text')
const legacy = `<file path="index.html"><!DOCTYPE html>\n<html><body>hi</body></html>\n</file>`
segs = parseActionSegments(legacy)
t('legacy <file path> artifact stays text', segs.length === 1 && segs[0].type === 'text')

console.log('── 6. streaming guard ──')
t('partial open tag cut off', unclosedActionTagStart('<file type="js') === 0)
t('open tag without close cut off', unclosedActionTagStart(`Sure!\n<file type="json" title="X"> {`) === 6)
t('closed tag → -1', unclosedActionTagStart(leak) === -1)
segs = parseActionSegments(`Sure!\n<file type="json" title="X"> {"na`, { streaming: true })
t('streaming hides unclosed tail', segs.length === 1 && segs[0].type === 'text' && !segs[0].text.includes('<file'))
segs = parseActionSegments(`Sure!\n${leak}`, { streaming: true })
t('streaming keeps closed tag as action', segs.some(s => s.type === 'action'))

console.log('── 7. tag-name variants ──')
segs = parseActionSegments(`<tool_call>{"name": "sandbox_git", "arguments": {"url": "u"}}</tool_call>`)
t('<tool_call> variant → action', segs[0].type === 'action' && segs[0].toolName === 'sandbox_git')
segs = parseActionSegments(`<FILE TYPE="json" TITLE="Up">{"name":"web_search","arguments":{"query":"x"}}</FILE>`)
t('uppercase tag + attrs → action', segs[0].type === 'action' && segs[0].title === 'Up')
const two = `${leak}\n\n<tool_call>{"name":"web_search","arguments":{"query":"q"}}</tool_call>`
segs = parseActionSegments(two)
t('two tags → two action segments in order', segs.filter(s => s.type === 'action').length === 2
  && segs.find(s => s.type === 'action').toolName === 'sandbox_git')

console.log('── 8. recoverToolCallFromText — pseudo-XML unwrap (new) ──')
let rec = recoverToolCallFromText(leak, KNOWN)
t('tag-wrapped JSON recovered', !!rec && rec.name === 'sandbox_git')
t('recovered args intact', rec?.args?.target_dir === 'appwrite')
rec = recoverToolCallFromText(`I'll clone it now.\n\n${leak}`, KNOWN)
t('recovery fires with surrounding prose', rec?.name === 'sandbox_git')
rec = recoverToolCallFromText(`<tool_call>{"name":"sandbox_git","arguments":{"url":"u"}}</tool_call>`, KNOWN)
t('<tool_call> wrapper recovered', rec?.name === 'sandbox_git')

console.log('── 9. recoverToolCallFromText — v5.15 behaviors intact ──')
rec = recoverToolCallFromText('```json\n{"name": "web_search", "arguments": {"query": "q"}}\n```', KNOWN)
t('```json fence still recovered', rec?.name === 'web_search')
rec = recoverToolCallFromText('{"tool": "sandbox_file", "parameters": {"path": "a"}}', KNOWN)
t('bare tool/parameters line still recovered', rec?.name === 'sandbox_file' && rec?.args?.path === 'a')
rec = recoverToolCallFromText('{"name": "made_up_tool", "arguments": {}}', KNOWN)
t('unknown tool name → null', rec === null)
rec = recoverToolCallFromText('just prose, no JSON', KNOWN)
t('plain prose → null', rec === null)

console.log('── 10. stripActionTagToolBlocks — sanitizer helper ──')
const isToolJson = (o) => KNOWN.has(String(o?.name || o?.tool || ''))
let stripped = stripActionTagToolBlocks(`Sure.\n\n${leak}\n\nRunning it now.`, isToolJson)
t('tool-JSON tag block removed', !stripped.includes('<file') && !stripped.includes('sandbox_git'))
t('prose kept with single spacing', stripped.includes('Sure.') && stripped.includes('Running it now.'))
stripped = stripActionTagToolBlocks(legacy, isToolJson)
t('legacy artifact body kept', stripped === legacy)
stripped = stripActionTagToolBlocks(`<file type="json">{"name":"made_up_tool","arguments":{}}</file>`, isToolJson)
t('unknown-tool tag kept for sanitizer', stripped.includes('<file'))

console.log('── 11. AIActionCard render (esbuild + react-dom/server) ──')
let html = ''
try {
  execFileSync('./node_modules/.bin/esbuild', [
    'scripts/v53015_card_harness.jsx',
    '--bundle', '--platform=node', '--format=cjs',
    '--alias:@=.', '--tsconfig=scripts/tsconfig.harness.json',
    '--outfile=/tmp/v53015-harness.cjs',
    '--log-level=error',
  ], { cwd: process.cwd(), stdio: 'pipe' })
  const { renderCard } = createRequire(import.meta.url)('/tmp/v53015-harness.cjs')
  html = renderCard({
    toolName: 'sandbox_git',
    title: 'Cloning Appwrite Repo',
    args: { url: 'https://github.com/appwrite/appwrite', branch: 'main' },
    rawJson: '{"name":"sandbox_git"}',
    valid: true,
  })
  t('card renders', html.includes('<div'))
  t('badge label present', html.includes('System action') || html.includes('chat.action.badge') || html.includes('Action'))
  t('title present', html.includes('Cloning Appwrite Repo'))
  t('tool name chip present', html.includes('sandbox_git'))
  t('args JSON pretty-printed', html.includes('https://github.com/appwrite/appwrite') && html.includes('branch'))
  t('footer label present', html.includes('System action payload'))
  t('chrome classes present', html.includes('rounded-2xl') && html.includes('bg-[#111]'))
  const invalid = renderCard({ toolName: 'unknown_tool', title: '', args: null, rawJson: '{"x":1}', valid: false })
  t('unparsed footer variant', invalid.includes('Unrecognized action payload'))
} catch (e) {
  t('card harness runs', false, String(e.message).slice(0, 160))
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
