// ── Notice cards + pill regression tests ─────────────────────────
// Verifies the chat-page UI round:
//   1. Recent-chats sidebar items are pill-shaped (rounded-full)
//   2. Gate/failure payloads classify into notice kinds (upgrade/quota/rate/error)
//   3. ChatNoticeCard renders for all four notification families,
//      mirroring the ComingSoonPopup design language
//   4. Legacy quotaExceeded history still renders as a notice card
//   5. Pro-gate popup restyled to the same card language
//   6. Previous-round regressions stay green (button guard, strict route)

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = '/home/z/my-project/kivora'
let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  PASS ${name}`) } else { fail++; console.log(`  FAIL ${name}`) } }
const strip = src => src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

const card = readFileSync(`${ROOT}/components/ChatNoticeCard.jsx`, 'utf8')
const raw = readFileSync(`${ROOT}/app/chat/ChatClient.jsx`, 'utf8')
const cc = strip(raw)
const route = readFileSync(`${ROOT}/app/api/chat/route.js`, 'utf8')

console.log('— ChatNoticeCard component —')
ok(existsSync(`${ROOT}/components/ChatNoticeCard.jsx`), 'component file exists')
ok(card.includes('data-chat-notice={tone}'), 'renders data-chat-notice marker')
ok(card.includes("bg-[#111] border border-[#262626] rounded-2xl"), 'ComingSoonPopup shell language (#111/#262626/rounded-2xl)')
ok(card.includes('upgrade:') && card.includes('quota:') && card.includes('error:'), 'three tones defined')
ok(['bolt', 'alert', 'hourglass', 'clock', 'warning'].every(k => card.includes(`${k}:`)), 'five icon glyphs')
ok(card.includes('max-w-sm text-center shadow-2xl'), 'centered card with shadow')
ok(card.includes('w-full py-2.5 bg-[#1a1a1a] border border-[#262626]'), 'full-width dark action button (Got-it style)')

console.log('— classification (applyChatMeta) —')
ok(cc.includes("msg.notice = 'upgrade'"), '402-with-plan / 403 → upgrade')
ok(cc.includes("msg.notice = 'quota'"), '402 credits / anon daily → quota')
ok(cc.includes("msg.notice = 'rate'"), 'other 429 → rate')
ok(cc.includes("msg.notice = 'error'"), 'remaining failures → error')
ok(cc.includes('msg.anonLimitReached = true'), 'daily-limit marker stored')
ok(cc.includes('if (data.upgrade_url) msg.upgradeUrl = data.upgrade_url'), 'upgrade_url captured for the action button')
ok(cc.includes('msg.quotaExceeded = true // legacy flag'), 'legacy flag kept for restored history')

console.log('— isError wiring (client-side failures) —')
ok(cc.includes("if (!data.reply && !acc.trim()) assistantMsg.isError = true"), 'stream empty-fallback flagged as error')
ok(cc.includes('const fellBack = !data.reply && !data.error'), 'legacy JSON fallback detected')
ok(/content: t\('chat\.error\.network'\), isError: true \}/.test(cc), 'network-error message flagged as error')
ok(!cc.includes("Upgrade your plan to keep going.' : ''"), 'appended text nudge removed (button replaces it)')

console.log('— noticeFor resolution —')
ok(cc.includes('const noticeFor = (msg, i) => {'), 'resolver defined')
ok(cc.includes("title: 'Upgrade to continue'"), 'upgrade card title')
ok(cc.includes("title: 'Daily limit reached'"), 'daily-limit card title')
ok(cc.includes("user ? 'Credits used up' : 'Free usage limit reached'"), 'quota card title (both auth states)')
ok(cc.includes("title: 'Slow down there'"), 'rate-limit card title (shortened)')
ok(cc.includes("title: 'Something went wrong'"), 'error card title')
ok(cc.includes('onAction: () => send(messages.slice(0, i))'), 'error card Try-again resends the exact conversation prefix')
ok(cc.includes('if (msg.notice === \'error\' || msg.isError)'), 'legacy isError messages render as error card')
ok(cc.includes('if (msg.quotaExceeded) {'), 'restored history (quotaExceeded only) falls back to quota card')

console.log('— render wiring —')
ok(cc.includes('const notice = noticeFor(msg, i)'), 'resolver invoked per message')
ok(cc.includes('notice ? (\n                        <ChatNoticeCard {...notice} />'), 'card rendered in assistant branch')
ok(!cc.includes('from-amber-500/10 to-orange-500/10'), 'old amber inline card fully removed')
ok(raw.includes("import ChatNoticeCard from '@/components/ChatNoticeCard'"), 'component imported')

console.log('— pill-shaped recent chats —')
ok(cc.includes("group relative flex items-center rounded-full transition-colors"), 'sidebar conversation rows are pills')
ok(!cc.includes("group relative flex items-center rounded-lg transition-colors"), 'old rounded-lg row gone')
ok(cc.includes('shrink-0 mr-1.5 p-1 rounded-full text-[#525252]'), 'delete button pill-consistent')

console.log('— Pro-gate popup restyle —')
ok(cc.includes('w-full max-w-[380px] bg-[#111] border border-[#262626] rounded-2xl p-6 sm:p-8 shadow-2xl text-center'), 'popup matches coming-soon shell')
ok(cc.includes('<IconLock size={20} />'), 'centered lock icon badge')
ok(cc.includes('rounded-xl bg-red-600 hover:bg-red-500'), 'primary CTA kept')

console.log('— previous-round regressions —')
ok((cc.match(/\(\) => send\(\)/g) || []).length >= 2, 'send buttons still arrow-wrapped')
ok(cc.includes('if (retryConvo && !Array.isArray(retryConvo)) retryConvo = null'), 'SyntheticEvent guard intact')
ok(route.includes('if (!Array.isArray(messages) || !messages.length)'), 'route strict validation intact')

console.log('— card copy round (shorter / professional / no arrows) —')
ok(!cc.includes('→'), 'no arrow glyphs anywhere in ChatClient action labels')
ok(cc.includes("body: 'Too many requests in a row — try again in a few seconds.'"), 'rate card body is short fixed copy')
ok(cc.includes("body: 'We hit a snag. Give it another try.'"), 'error card body is short fixed copy')
ok(!cc.includes('You\'re sending messages too quickly'), 'verbatim server rate copy no longer shown in card')
ok(cc.includes("actionLabel: 'Upgrade plan',"), 'upgrade action arrow-free')
ok(cc.includes("actionLabel: 'Sign in for more',"), 'sign-in action arrow-free')
ok(cc.includes("actionLabel: 'Try again'"), 'error retry action unchanged')

console.log('— message streaming polish —')
ok(cc.includes('const [streaming, setStreaming] = useState(false)'), 'streaming presentation state declared')
ok(cc.includes('setStreaming(true)'), 'streaming flag raised when SSE reply starts')
ok((cc.match(/setStreaming\(false\)/g) || []).length >= 2, 'streaming flag cleared on finish + failure paths')
ok(raw.includes('streaming={streaming && i === messages.length - 1}'), 'caret prop only on the active last message')
const md = readFileSync(`${ROOT}/components/MarkdownRenderer.jsx`, 'utf8')
ok(md.includes("streaming = false"), 'MarkdownRenderer accepts streaming prop')
ok(md.includes("streaming ? ' md-streaming' : ''"), 'prose wrapper gains md-streaming class')
const css = readFileSync(`${ROOT}/app/globals.css`, 'utf8')
ok(css.includes('@keyframes caretBlink'), 'caret blink keyframes defined')
ok(css.includes('.md-streaming > p:last-child::after'), 'caret scoped to last text block')
ok(!css.includes('.md-streaming > pre'), 'caret never lands inside code blocks')

console.log('— picture streaming polish —')
ok(cc.includes("evt.type === 'status' && evt.tool === 'generate_image'"), 'client consumes status event')
ok(cc.includes('setImageGenerating(true)'), 'imageGenerating raised on status event')
ok((cc.match(/setImageGenerating\(false\)/g) || []).length >= 2, 'imageGenerating cleared on all exits')
ok(route.includes("send({ type: 'status', tool: toolCall.function.name })"), 'server emits status event before tool runs')
ok(route.includes('if (send) {'), 'status emission guarded for non-streaming requests')
ok(cc.includes('function ImageGeneratingCard()'), 'shimmer placeholder component defined')
ok(cc.includes('data-image-generating="true"'), 'shimmer card marker present')
ok(cc.includes('image-gen-shimmer'), 'shimmer card uses brand shimmer surface')
ok(cc.includes('Creating your image'), 'shimmer card human copy')
ok(cc.includes('{loading && imageGenerating ? ('), 'shimmer replaces thinking orb during image gen')
ok(cc.includes("String(messages[messages.length - 1].content || '').trim()"), 'orb hidden once streamed text is flowing')
ok(cc.includes('data-image-card="true"'), 'image reply card marker present')
ok(cc.includes('image-reveal'), 'image reply fades in (reveal animation)')
ok(css.includes('@keyframes imageIn'), 'image reveal keyframes defined')
ok(cc.includes('href={msg.imageUrl || msg.imageData}'), 'download works for data-URL-only images')
ok(cc.includes('alt={msg.imagePrompt ||'), 'image alt carries the prompt')
ok(cc.includes("{msg.imagePrompt || 'AI generated image'}"), 'prompt caption under image')
ok(css.includes('.image-gen-pulse'), 'shimmer icon pulse defined')

console.log(`\n${pass}/${pass + fail} assertions passed`)
process.exit(fail ? 1 : 0)
