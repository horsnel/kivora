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
