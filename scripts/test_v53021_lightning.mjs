// ════════════════════════════════════════════════════════════════════
// test_v53021_lightning.mjs — v5.30.21: sidebar X removal + Lightning AI
// gateway wiring + hosting docs. Wiring asserts over source; the gateway
// hop is env-gated and fails open, so behavior without the env is covered
// by the functional probe (composer + reply path unchanged).
// ════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'

const nb = readFileSync('components/Navbar.jsx', 'utf8')
const gq = readFileSync('lib/groq.js', 'utf8')
const ms = readFileSync('lib/mistral.js', 'utf8')
const cr = readFileSync('app/api/chat/route.js', 'utf8')

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

console.log('── Sidebar X removal ──')
ok('IconClose no longer imported in Navbar', !nb.includes('IconClose'))
ok('close button block removed (logo row)', !nb.includes('hover:text-white transition-colors"') || !/<IconClose/.test(nb))
ok('overlay close kept (mobile drawer still closable)', nb.includes('onClick={() => setMobileOpen(false)}'))
ok('v5.30.21 note present', nb.includes('v5.30.21 — the sidebar\'s X (close) button removed'))

console.log('── Lightning gateway: chat/vision chain (lib/groq.js) ──')
ok('setLightningConfig exported', gq.includes('export function setLightningConfig'))
ok('hop exists in BOTH chains (text + vision)', (gq.match(/name: 'lightning'/g) || []).length === 2)
ok('hop is FIRST in the text chain', gq.indexOf("name: 'lightning'") < gq.indexOf("name: 'siliconflow'"))
ok('hop is FIRST in the vision chain', gq.indexOf("name: 'lightning'") < gq.indexOf("name: 'groq-primary'"))
ok('fails open when unconfigured (available: !!_lightningBase)', /available: \(\) => !!_lightningBase/.test(gq))
ok('bare-origin normalization (no /v1 doubling)', gq.includes(".replace(/\\/v1$/, '')"))
ok('generous timeout for self-hosted GPU', gq.includes('lightning: 45_000'))
ok('OpenAI-compatible URL (base + /v1)', gq.includes("baseURL: `${_lightningBase}/v1`"))

console.log('── Lightning gateway: mistral chain (lib/mistral.js) ──')
ok('setLightningEndpoint exported', ms.includes('export function setLightningEndpoint'))
ok('mistralChat tries the gateway first', /export async function mistralChat\(\{[\s\S]{0,200}tryLightning\(/.test(ms))
ok('mistralChatStream tries the gateway first (SSE relay)', /export async function mistralChatStream\(\{[\s\S]{0,260}tryLightning\([\s\S]{0,120}stream: true, onDelta/.test(ms))
ok('serves mistral-small-latest under canonical ID', ms.includes("LIGHTNING_MODEL = 'mistral-small-latest'"))
ok('fail-open to the ladder on gateway error', ms.includes('falling to Mistral ladder'))

console.log('── Env wiring ──')
ok('chat route: LIGHTNING_BASE_URL/API_KEY via getEnvVar', cr.includes("getEnvVar('LIGHTNING_BASE_URL')") && cr.includes("getEnvVar('LIGHTNING_API_KEY')"))
for (const r of ['app/api/devtools/route.js', 'app/api/study/route.js', 'app/api/reelpen/route.js', 'app/api/explore/route.js', 'app/api/browser/ask/route.js']) {
  const s = readFileSync(r, 'utf8')
  ok(`${r.split('/')[2]}: setLightningEndpoint wired`, s.includes("setLightningEndpoint(await getEnvVar('LIGHTNING_BASE_URL')") && s.includes('setLightningEndpoint,') || s.includes(', setLightningEndpoint'))
}

console.log('── Lightning deployment artifacts ──')
ok('litserve service exists', existsSync('lightning/service.py'))
ok('voice (whisper) service exists', existsSync('lightning/voice_service.py'))
ok('requirements pinned', existsSync('lightning/requirements.txt'))
ok('deploy runbook exists', existsSync('lightning/deploy.md'))
ok('model hosting inventory exists', existsSync('docs/MODEL_HOSTING.md'))
try {
  execSync('python3 -m py_compile lightning/service.py lightning/voice_service.py', { stdio: 'pipe' })
  ok('python services compile', true)
} catch (e) {
  ok('python services compile', false)
}
for (const id of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'deepseek-r1-distill-llama-70b', 'mistral-small-latest', 'FLUX.1-schnell', 'large-v3']) {
  ok(`inventory lists ${id}`, readFileSync('docs/MODEL_HOSTING.md', 'utf8').includes(id))
}
ok('janitor documented as model-free', readFileSync('docs/MODEL_HOSTING.md', 'utf8').includes('deterministic'))

console.log(`v5.30.21 suite: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
