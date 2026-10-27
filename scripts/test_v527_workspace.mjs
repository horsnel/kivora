#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// test_v527_workspace.mjs — agent workspace wiring:
//  1. toolRegistry integration (VFS tiers, ctx threading, instructions)
//  2. REAL bash execution of the generated workspace script — stages
//     files, runs a command that creates new files, auto-captures them
//  3. UI wiring (ChatClient button/panel) + i18n keys
// ════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { buildWorkspaceScript, parseCapturedOutput } from '../lib/vfs.js'

let pass = 0, fail = 0
const failures = []
const ok = (c, name) => { if (c) pass++; else { fail++; failures.push(name); console.error('  ✗', name) } }
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const has = (h, n) => h.includes(n)

// ═══ 1. toolRegistry integration ═══
console.log('── v5.27: toolRegistry ──')
const reg = src('lib/toolRegistry.js')
ok(has(reg, "import { vfsWrite, vfsRead, vfsList, vfsDelete, buildWorkspaceScript, parseCapturedOutput"), 'vfs imported into registry')
ok(has(reg, 'async sandbox_exec(args, ctx)'), 'sandbox_exec receives ctx')
ok(has(reg, 'async sandbox_file(args, ctx)'), 'sandbox_file receives ctx')
ok(has(reg, "executor: 'kivora-vfs'"), 'sandbox_file VFS executor tag')
ok(has(reg, 'const script = buildWorkspaceScript(args.command, staged)'), 'exec stages workspace into script')
ok(has(reg, 'const parsed = parseCapturedOutput(result.stdout'), 'exec parses captured output')
ok(has(reg, 'saved_files: saved'), 'exec returns saved_files to the AI')
ok(has(reg, 'persisted: true'), 'file ops report persistence')
ok(has(reg, "executor: 'judge0-vfs'"), 'exec VFS executor tag')
ok(has(reg, 'error: \'workspace_unavailable\''), 'anon boundary message (honest, sign-in required)')
ok(has(reg, 'sign_in_required: true'), 'sign-in flag for the AI to relay')
ok(has(reg, 'PERSISTENT WORKSPACE: sandbox_file and sandbox_exec save files'), 'system prompt teaches the workspace')
ok(has(reg, "saved to the user's persistent workspace"), 'saved_note instructs the AI to report saves')
ok(has(reg, 'saved_to_workspace: true, workspace_path: w.path'), 'generate_downloadable persists too')
ok(has(reg, "PERSISTENT WORKSPACE mounted"), 'sandbox_exec description mentions the workspace')
ok(has(reg, 'Files survive across sessions'), 'sandbox_file description mentions persistence')
// VFS tier comes AFTER the real sandboxes (infra-independent behavior preserved)
const cfIdx = reg.indexOf('3. Try Cloudflare Sandbox')
const vfsIdx = reg.indexOf('4. No real sandbox')
ok(cfIdx > -1 && vfsIdx > cfIdx, 'VFS is the last tier (real sandboxes still win)')

// ═══ 2. REAL bash run of the wrapper ═══
console.log('── v5.27: workspace script — live bash run ──')
const stageB64 = Buffer.from('print("hello from workspace")\n').toString('base64')
const script = buildWorkspaceScript(
  `echo "run starts"\nprintf 'x=42\\ny=hello\\n' > out.txt\nprintf 'a,b\\n1,2\\n3,4\\n' > data.csv\ncat src/main.py\necho "done rc=$?"`,
  [{ path: 'src/main.py', b64: stageB64 }]
)
let out = ''
try {
  out = execSync('bash', { input: script, encoding: 'utf8', timeout: 15000 })
} catch (e) {
  out = e.stdout || ''
}
const parsed = parseCapturedOutput(out)
ok(parsed.output.includes('hello from workspace'), 'staged file visible to the command (cat src/main.py)')
ok(parsed.output.includes('run starts') && parsed.output.includes('done rc=0'), 'command stdout intact')
ok(parsed.exitCode === 0, 'user command exit code extracted')
const paths = parsed.files.map((f) => f.path).sort()
ok(JSON.stringify(paths) === JSON.stringify(['data.csv', 'out.txt']), `exactly the created files captured (got ${JSON.stringify(paths)})`)
const csv = parsed.files.find((f) => f.path === 'data.csv')
ok(csv && Buffer.from(csv.b64, 'base64').toString('utf8') === 'a,b\n1,2\n3,4\n', 'captured content round-trips')
ok(!parsed.output.includes('__KV_FILE__') && !parsed.output.includes('__KV_RC__'), 'no markers leak into visible output')

// marker semantics: files OLDER than the marker are NOT re-captured
const script2 = buildWorkspaceScript('echo only-this', [])
let out2 = ''
try { out2 = execSync('bash', { input: script2, encoding: 'utf8', timeout: 15000 }) } catch (e) { out2 = e.stdout || '' }
const parsed2 = parseCapturedOutput(out2)
ok(parsed2.files.length === 0, 'no phantom captures on a clean run')

// ═══ 3. UI wiring + i18n ═══
console.log('── v5.27: UI + i18n ──')
const chat = src('app/chat/ChatClient.jsx')
const panel = src('components/chat/WorkspacePanel.jsx')
ok(has(chat, "dynamic(() => import('@/components/chat/WorkspacePanel')"), 'panel lazy-imported')
ok(has(chat, 'onClick={() => setWsOpen(true)}'), 'toolbar button opens panel')
ok(has(chat, '<WorkspacePanel'), 'panel mounted in chat')
ok(has(chat, 'getToken={async () => user ? (await supabasePublic?.auth?.getSession())'), 'panel gets the access token')
ok(has(panel, "'/api/vfs'"), 'panel hits the VFS API')
ok(has(panel, 'download=1'), 'blob download flow')
ok(has(panel, "method: 'DELETE'"), 'delete flow')
ok(has(panel, "res.status === 401") && has(panel, "setSignedOut(true)"), '401 → sign-in state')
ok(has(panel, 'aria-label={t(\'vfs.title\')}'), 'localized label')
ok(has(panel, '#FF3366') && has(panel, '#0d0d0d') && has(panel, '#262626'), 'HUSH palette')

const route = src('app/api/vfs/route.js')
ok(has(route, "export const runtime = 'edge'"), 'vfs route edge runtime')
ok(has(route, 'resolveUserAndAdmin'), 'bearer auth via shared helper')
ok(has(route, "download=1") || has(route, "'download'"), 'download action present')

for (const loc of ['en', 'fr', 'sw', 'yo']) {
  const i18n = JSON.parse(src(`lib/i18n/${loc}.json`))
  ok(i18n['vfs.title'] && i18n['vfs.empty'] && i18n['vfs.hint'], `vfs keys present in ${loc}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) { console.error('FAILED:', failures.join(' | ')); process.exit(1) }
