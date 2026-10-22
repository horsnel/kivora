// v5.18 verification grid — card design reuse + long-press session menu + mobile pass
// 1. NoticeCard reproduces the ConfirmDialog design DNA exactly
// 2. Explore routes gate errors (402 "out of credits") into that card
// 3. ChatClient: 450ms long-press on conversations → same-design card with
//    Pin / Rename / Share / Delete, meta persisted (DB attempt + localStorage mirror)
// 4. Pinned conversations float above date groups
// 5. Mobile pass: safe-area composer, wider bubbles, tap-highlight, overflow-x clip
// 6. i18n: 17 new keys present in all four locales
// 7. Migration SQL ships the title/pinned columns (idempotent)
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

// ── 1. NoticeCard — same design DNA as ConfirmDialog ──────────────────
console.log('\n[1] NoticeCard design parity')
const notice = read('components/NoticeCard.jsx')
const confirm = read('components/ConfirmDialog.jsx')
for (const token of [
  'fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm',
  'w-full max-w-[360px] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-scale-in',
  'w-9 h-9 rounded-full bg-[#FF3366]/12 border border-[#FF3366]/25',
  'text-body text-white font-semibold leading-snug mb-1.5',
  'text-caption text-muted leading-relaxed mb-4',
  'rounded-xl bg-[#FF3366] text-caption text-white font-semibold hover:bg-[#e62e5c]',
]) {
  check(`NoticeCard shares token: ${token.slice(0, 44)}…`, notice.includes(token) && confirm.includes(token))
}
check('NoticeCard has Escape close', notice.includes("e.key === 'Escape'"))
check('NoticeCard has alertdialog role', notice.includes('role="alertdialog"'))
check('ConfirmDialog untouched (still 2-button delete card)', confirm.includes("confirmLabel || 'Delete'"))

// ── 2. Explore — gate errors land in the card ─────────────────────────
console.log('\n[2] Explore out-of-credits card')
const explore = read('app/explore/page.jsx')
check('explore imports NoticeCard', explore.includes("import NoticeCard from '@/components/NoticeCard'"))
check('error kind state exists', explore.includes("useState('generic')") && explore.includes('searchErrorKind'))
check('402/403 → credits kind', /402 \|\| res\.status === 403 \? 'credits'/.test(explore))
check('429 → rate kind', explore.includes("res.status === 429 ? 'rate'"))
check('5xx → engine kind', explore.includes("res.status >= 500 ? 'engine'"))
check('network → network kind', explore.includes("setSearchErrorKind('network')"))
check('ERROR_TITLES has credits title', explore.includes("credits: 'Out of credits'"))
check('server message surfaced verbatim as card message', explore.includes('message={searchError}'))
check('old inline banner removed', !explore.includes('bg-red-950/40'))

// ── 3. ChatClient — long-press session action card ────────────────────
console.log('\n[3] Chat session long-press card')
const chat = read('app/chat/ChatClient.jsx')
check('session action state exists', chat.includes('const [sessionAction, setSessionAction]'))
check('450ms long-press timer', chat.includes('sessionPressRef.current.timer = setTimeout'))
check('press movement cancels (>8px)', /Math\.abs\(e\.clientX - p\.x\) > 8/.test(chat.split('moveSessionPress')[1] || ''))
check('click after hold is swallowed', chat.includes('sessionClickGuard'))
check('haptic feedback on hold', /navigator\.vibrate\?\.\(15\)/.test(chat))
check('card uses ConfirmDialog shell', chat.includes('w-full max-w-[360px] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-scale-in'))
check('Pin option wired', chat.includes('toggleSessionPin'))
check('Rename option wired (inline mode)', chat.includes('commitSessionRename') && chat.includes('setSessionRenameMode(true)'))
check('Share option wired (Web Share + clipboard fallback)', chat.includes('navigator.share') && chat.includes('navigator.clipboard.writeText(text)'))
check('Delete option routes through confirm card', /const sid = sessionAction\.sid; closeSessionAction\(\); deleteSession\(sid\)/.test(chat))
check('Escape closes card', /sessionAction[\s\S]{0,400}e\.key === 'Escape'/.test(chat))

console.log('\n[4] Rename/Pin persistence')
check('localStorage mirror key', chat.includes("CHAT_META_KEY = 'kivora:chat-session-meta'"))
check('DB write attempted (title/pinned columns)', /\.from\('chat_sessions'\)\s*\n\s*\.update\(patch\)/.test(chat))
check('DB write scoped to owner', chat.includes(".eq('user_id', user.id)"))
check('delete cleans up ghost meta', /performDeleteSession[\s\S]{0,200}removeSessionMeta\(sid\)/.test(chat))
check('pinned group above dates', chat.includes("groups.push({ labelKey: 'chat.date.pinned', sessions: pinned })"))
check('renamed title wins in chatTitle', /const metaTitle = sessionMeta\[session\?\.id\]\?\.title[\s\S]{0,120}if \(metaTitle\) return metaTitle/.test(chat))
check('pin indicator dot on rows', chat.includes('text-[#FF3366] shrink-0'))

// ── 5. Mobile pass ─────────────────────────────────────────────────────
console.log('\n[5] Mobile optimization')
check('user bubbles wider on mobile (85%)', chat.includes('max-w-[85%] sm:max-w-[65%]'))
check('composer respects safe area', chat.includes('pb-[max(16px,env(safe-area-inset-bottom))]'))
check('sidebar respects safe area', chat.includes('pb-[max(10px,env(safe-area-inset-bottom))]'))
const globals = read('app/globals.css')
check('tap flash killed globally', globals.includes('-webkit-tap-highlight-color: transparent'))
check('horizontal overflow clipped (sticky-safe)', globals.includes('overflow-x: clip'))
const md = read('components/MarkdownRenderer.jsx')
check('code blocks scroll horizontally (no page overflow)', md.includes('overflow-x-auto'))

// ── 6. i18n — 17 keys × 4 locales ──────────────────────────────────────
console.log('\n[6] i18n coverage')
const KEYS = ['common.ok','home.err.credits','home.err.rate','home.err.engine','home.err.network','home.err.generic','chat.date.pinned','chat.session.subtitle','chat.session.pin','chat.session.unpin','chat.session.rename','chat.session.rename_title','chat.session.rename_save','chat.session.name_placeholder','chat.session.share','chat.session.delete','chat.session.shared']
for (const lang of ['en', 'fr', 'sw', 'yo']) {
  const data = JSON.parse(read(`lib/i18n/${lang}.json`))
  const missing = KEYS.filter(k => !data[k])
  check(`${lang}: all ${KEYS.length} keys present`, missing.length === 0)
  if (missing.length) console.log('     missing:', missing.join(', '))
}

// ── 7. Migration SQL ───────────────────────────────────────────────────
console.log('\n[7] Migration SQL')
const sql = read('chat-session-meta-migration.sql')
check('adds title column (idempotent)', sql.includes('add column if not exists title text'))
check('adds pinned column (idempotent)', sql.includes('add column if not exists pinned boolean default false'))

console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`)
process.exit(fail ? 1 : 0)
