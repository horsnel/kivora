// ── v5.30.16 message action bar helpers ─────────────────────────────
// Pure logic behind the chat action bar (copy / quote-reply / save to
// workspace / feedback / rerun). Framework-free so the battery can unit-test
// the exact strings and shapes the UI produces — same pattern as
// lib/actionTags.js. Client-only use (ChatClient).
import { stripMarkdown } from './stripMarkdown.js'

// Quote-reply source: the user's live text selection wins (they highlighted
// exactly what they want to reference); otherwise the full message, stripped
// of markdown so the composer gets clean prose, not **markup** noise.
// Capped so quoting a whole essay can't flood the composer.
export function pickQuoteSource(selection, content, cap = 600) {
  const sel = String(selection || '').trim()
  let out = sel || stripMarkdown(String(content || '')).trim()
  if (out.length > cap) out = out.slice(0, cap).trimEnd() + '…'
  return out
}

// Markdown block-quote form, one "> " prefix per line, so the composer shows
// an unambiguous quotation the user can trim before sending.
export function buildQuoteText(raw) {
  return String(raw || '')
    .split('\n')
    .map(l => `> ${l}`)
    .join('\n')
}

// Filename for "Save to workspace": notes/ai-response-YYYY-MM-DD-HHMMSS.md
// (second precision — two saves in the same minute never collide).
export function workspaceFilename(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `ai-response-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.md`
}

// Regenerate the reply at `index`: everything before it must survive and end
// exactly on the user message that produced it. Returns the conversation to
// re-send, or null when the shape doesn't allow rerun (no prior user turn,
// index out of bounds, non-array).
export function rerunTruncation(messages, index) {
  if (!Array.isArray(messages) || !messages.length) return null
  if (!Number.isInteger(index) || index <= 0 || index >= messages.length) return null
  const truncated = messages.slice(0, index)
  const last = truncated[truncated.length - 1]
  return last && last.role === 'user' ? truncated : null
}

// ── v5.30.17 reply reference ("@-mention") helpers ──────────────────

// The reply chip and the on-send context both name the referenced message
// with an @-mention. Kivora is the brand (never translated); the user is
// "@You". Quote applies to assistant replies, so '@Kivora' is the norm.
export function mentionLabel(role) {
  return role === 'user' ? '@You' : '@Kivora'
}

// One-line excerpt for the reply chip: newlines flattened, capped so a huge
// message can't blow out the composer's height.
export function replyChipExcerpt(raw, cap = 96) {
  const s = String(raw || '').replace(/\s*\n+\s*/g, ' ').trim()
  if (!s) return ''
  return s.length > cap ? s.slice(0, cap).trimEnd() + '…' : s
}

// The blockquote context prepended to the outgoing message when a reply
// reference is active. The model sees exactly which prior message the new
// question is about; the client renders it as a tidy blockquote bubble.
// Single line (newlines flattened) and capped so the context can never
// outweigh the user's actual question.
export function buildReplyContext(excerpt, role) {
  const q = replyChipExcerpt(excerpt, 200)
  if (!q) return ''
  return `> ${mentionLabel(role)}: "${q}"`
}

// ── v5.30.18 user-bubble quote split ────────────────────────────────
// User messages may START with "> " lines: the reply chip's @-mention
// context, or a quote the user typed themselves. Those lines render as a
// styled quote block (left border + muted tone, mirroring the assistant's
// blockquote design), not raw markup — while the wire format is unchanged
// (the model still receives the full "> …" context). Requires the space:
// ">5 vs 3" is a comparison, not a quote, and stays raw text.
export function splitUserQuote(content) {
  const lines = String(content || '').split('\n')
  const quoteLines = []
  let i = 0
  while (i < lines.length && lines[i].startsWith('> ')) {
    quoteLines.push(lines[i].replace(/^> /, ''))
    i++
  }
  if (quoteLines.length === 0) return { quote: null, body: String(content || '') }
  // one blank separator line between the quote block and the user's words
  if (i < lines.length && lines[i].trim() === '') i++
  const body = lines.slice(i).join('\n').trim()
  return { quote: quoteLines.join('\n').trim(), body }
}
