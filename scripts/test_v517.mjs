// v5.17 unit tests — lib/runCode.js pure logic + deploy patterns + confirm wiring
import { _internals } from '../lib/runCode.js'
import { readFileSync } from 'fs'

const { JUDGE0_TO_WANDOX, PINNED, versionKey } = _internals
let pass = 0, fail = 0
function t(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.log(`  ✗ ${name}: ${e.message}`) }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed') }

console.log('── runCode: language coverage ──')
t('all 9 Wandbox-covered Judge0 ids have selectors + pinned fallbacks', () => {
  const covered = [71, 63, 54, 50, 60, 73, 72, 68, 46]
  for (const id of covered) {
    assert(JUDGE0_TO_WANDOX[id], `id ${id} missing selector`)
    assert(PINNED[id], `id ${id} missing pinned compiler`)
  }
})
t('uncovered ids (74 ts, 62 java, 82 sql) correctly absent', () => {
  for (const id of [74, 62, 82]) assert(!JUDGE0_TO_WANDOX[id], `id ${id} should NOT be covered`)
})
t('versionKey sorts numerically not lexicographically', () => {
  assert(JSON.stringify(versionKey('cpython-3.14.0')) === JSON.stringify([3, 14, 0]), `got ${versionKey('cpython-3.14.0')}`)
  const sorted = ['cpython-3.9.20', 'cpython-3.13.8', 'cpython-3.14.0'].sort((a, b) => {
    const ka = versionKey(a), kb = versionKey(b)
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      const d = (ka[i] || 0) - (kb[i] || 0)
      if (d !== 0) return d
    }
    return 0
  })
  assert(sorted[sorted.length - 1] === 'cpython-3.14.0', `newest should be 3.14.0, got ${sorted[sorted.length - 1]}`)
})
t('pickCompiler picks newest C compiler with -c suffix (live list)', async () => {
  const c = await _internals.pickCompiler(50)
  assert(c && /^gcc-\d+(\.\d+)*-c$/.test(c), `bad C compiler: ${c}`)
  const cpp = await _internals.pickCompiler(54)
  assert(cpp && /^gcc-\d+(\.\d+)*$/.test(cpp), `bad C++ compiler: ${cpp} (bare gcc expected)`)
  assert(!cpp.endsWith('-c'), 'C++ must not use the -c (C) compiler')
  const py = await _internals.pickCompiler(71)
  assert(py && /^cpython-3\.\d+\.\d+$/.test(py), `bad python: ${py}`)
}, )
t('pickCompiler bash exact match', async () => {
  const b = await _internals.pickCompiler(46)
  assert(b === 'bash', `got ${b}`)
})

console.log('── vibecoding: doctrine + patterns ──')
const reg = readFileSync('../lib/toolRegistry.js', 'utf8')
t('VIBECODING doctrine present in tool instructions', () => {
  assert(reg.includes('VIBECODING — build anything start to finish'), 'doctrine missing')
  assert(reg.includes('CALL deploy_site in the SAME turn'), 'auto-deploy rule missing')
  assert(reg.includes('NO placeholders'), 'completeness rule missing')
})
t('deploy forcing catches ship it / go live / make it a website', () => {
  const m = reg.match(/const deployPatterns = \[([\s\S]*?)\]/)
  assert(m, 'deployPatterns block not found')
  const patterns = eval('[' + m[1] + ']')
  const cases = [
    ['deploy my site', true], ['ship it', true], ['go live', true],
    ['take it live', true], ['make it a real website', true],
    ['build me a todo app', false], // build ≠ deploy — doctrine handles build
  ]
  for (const [q, expect] of cases) {
    const hit = patterns.some(p => p.test(q.toLowerCase()))
    assert(hit === expect, `"${q}" expected ${expect}, got ${hit}`)
  }
})
t('old clarifying-questions deploy instruction removed', () => {
  assert(!reg.includes('ask 2-3 clarifying questions first'), 'old DEPLOY_SITE instruction still present')
})

console.log('── confirm card wiring ──')
const files = {
  community: '../app/community/page.jsx',
  research: '../app/research/page.jsx',
  dashboard: '../app/dashboard/page.jsx',
  chat: '../app/chat/ChatClient.jsx',
}
t('all four pages import ConfirmDialog and gate deletes', () => {
  for (const [name, path] of Object.entries(files)) {
    const src = readFileSync(path, 'utf8')
    assert(src.includes("import ConfirmDialog from '@/components/ConfirmDialog'"), `${name}: import missing`)
    assert(src.includes('<ConfirmDialog'), `${name}: dialog not mounted`)
  }
})
t('no instant delete buttons remain on community', () => {
  const src = readFileSync('../app/community/page.jsx', 'utf8')
  assert(!src.includes('onClick={() => deletePost('), 'instant deletePost still wired')
  assert(!src.includes('onClick={() => deleteReply('), 'instant deleteReply still wired')
})
t('chat no longer uses window.confirm', () => {
  const src = readFileSync('../app/chat/ChatClient.jsx', 'utf8')
  assert(!/window\.confirm\s*\(/.test(src), 'window.confirm still present')
})
t('i18n: all 4 languages carry the 3 new confirm keys', () => {
  for (const lang of ['en', 'fr', 'sw', 'yo']) {
    const d = JSON.parse(readFileSync(`../lib/i18n/${lang}.json`, 'utf8'))
    assert(d['common.delete_confirm_title'], `${lang}: title missing`)
    assert(d['common.delete_confirm_body'], `${lang}: body missing`)
    assert(d['common.delete_confirm_action'], `${lang}: action missing`)
    assert(d['common.cancel'], `${lang}: cancel missing`)
  }
})
t('ConfirmDialog: cancel-focused first, Escape closes, busy state', () => {
  const src = readFileSync('../components/ConfirmDialog.jsx', 'utf8')
  assert(src.includes('cancelRef.current?.focus'), 'cancel focus missing')
  assert(src.includes("e.key === 'Escape'"), 'escape handling missing')
  assert(src.includes('busy'), 'busy prop missing')
})

console.log(`\n${pass}/${pass + fail} tests passed`)
process.exit(fail ? 1 : 0)
