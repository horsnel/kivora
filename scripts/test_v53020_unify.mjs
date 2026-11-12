// ════════════════════════════════════════════════════════════════════
// test_v53020_unify.mjs — v5.30.20: copy/toast unification + zero-DDL
// feedback persistence + global mono stack. Wiring asserts over source.
// Functional targets are covered by probe_v53020_unify.mjs.
// ════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'fs'

const cc = readFileSync('app/chat/ChatClient.jsx', 'utf8')
const ft = readFileSync('components/FeedbackToast.jsx', 'utf8')
const md = readFileSync('components/MarkdownRenderer.jsx', 'utf8')
const rp = readFileSync('app/research/page.jsx', 'utf8')
const cpc = readFileSync('components/CodePreviewCard.jsx', 'utf8')
const sql = readFileSync('chat-message-feedback-migration.sql', 'utf8')

let pass = 0, fail = 0
const ok = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

console.log('── Zero-DDL feedback persistence ──')
ok('showFeedback imported in ChatClient', cc.includes("import { showFeedback } from '@/components/FeedbackToast'"))
ok('toggleFeedback embeds votes into messages jsonb', cc.includes(".update({ messages: stamped })"))
ok('embed applies full map (stampedMsg.feedback = hit)', cc.includes('stampedMsg.feedback = hit'))
ok('embed respects RLS scoping (eq user_id)', /\.update\(\{ messages: stamped \}\)[\s\S]{0,200}\.eq\('user_id', user\.id\)/.test(cc))
ok('deriveFeedbackFromMessages helper exists', cc.includes('function deriveFeedbackFromMessages(msgs)'))
ok('loadSession derives from messages (embedded wins)', /deriveFeedbackFromMessages\(session\.messages\), \/\/ v5\.30\.20/.test(cc))
ok('legacy maps still merged for pre-5.30.20 votes', cc.includes('...normalizeFeedback(localMeta.feedback, session.messages),'))
ok('SQL file marked optional', sql.includes('OPTIONAL since v5.30.20'))

console.log('── Copy → global toast ──')
ok('chat copy() fires the global toast', /function copy\(content, i\) \{[\s\S]{0,1400}showFeedback\(\{ variant: 'toast', message: t\('chat\.actions\.copied'\) \}\)/.test(cc))
ok('chat copy() has the clipboard fallback (no unhandled rejection)', cc.includes('document.execCommand(\'copy\')'))
ok('bubble card no longer swaps to inline "Copied" text', !cc.includes("? 'Copied' : 'Copy'"))
ok('bubble card always shows the copy icon (card closes + toast)', /v5\.30\.20 — no inline "Copied" swap/.test(cc))
ok('MarkdownRenderer code copy fires the global toast', md.includes("showFeedback({ variant: 'toast', message: 'Copied to clipboard' })"))
ok('FeedbackToast imported in MarkdownRenderer', md.includes("import { showFeedback } from '@/components/FeedbackToast'"))
ok('toast pill z-[10000] (was z-[90] — ghost box behind research text)', ft.includes('z-[10000]'))
ok('toast cards container z-[10000]', (ft.match(/z-\[10000\]/g) || []).length >= 2)
ok('no old z-[90] left in FeedbackToast', !ft.includes('z-[90]'))
ok('i18n key chat.actions.copied wired in chat copy', cc.includes("t('chat.actions.copied')"))

console.log('── Global mono stack ──')
ok('research page: zero ui-monospace stragglers', !rp.includes('ui-monospace'))
ok('research page: 4 rules use var(--font-mono)', (rp.match(/font-family: var\(--font-mono\)/g) || []).length === 4)
ok('CodePreviewCard: zero literal mono stacks', !cpc.includes("'SF Mono'"))
ok('CodePreviewCard: var(--font-mono) ×4', (cpc.match(/font-family: var\(--font-mono\)/g) || []).length === 4)

console.log('── i18n ──')
for (const lang of ['en', 'fr', 'sw', 'yo']) {
  const raw = readFileSync(`lib/i18n/${lang}.json`, 'utf8')
  ok(`chat.actions.copied present in ${lang}`, raw.includes('"chat.actions.copied"'))
}

console.log('── guard rails ──')
ok('probes committed', existsSync('scripts/probe_v53020_unify.mjs'))

console.log(`v5.30.20 suite: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
