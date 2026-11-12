// ── v5.30.17 text repair helpers ────────────────────────────────────
// Pure, framework-free repair logic shared by three consumers:
//   • the chat page's render path (self-healing display while streaming
//     or when a legacy partial reply was saved before the server polished
//     it — an unclosed fence used to paint the rest of the bubble as code)
//   • the nightly janitor (scripts/maintenance/janitor.mjs), which applies
//     the same deterministic rules to chat_sessions.history in the database
//   • the unit battery (scripts/test_v5.30.17.mjs)
// No AI rewrite here on purpose: repairs must be deterministic and
// meaning-preserving. Closing a fence or dropping a known failure notice
// cannot hallucinate; rewriting user-visible history could.
import { stripMarkdown } from './stripMarkdown.js'

// A fence is "unclosed" when ``` runs appear an odd number of times — the
// same heuristic the server's sanitizer has used since v5.24.2, so client
// display and janitor repair agree with what the save path already does.
export function hasUnclosedFence(text) {
  const s = String(text || '')
  if (!s.includes('```')) return false
  return ((s.match(/```/g) || []).length) % 2 === 1
}

// Close an unclosed fence by appending the missing ``` after the block body.
// Mirrors the server's "CLOSE it instead of amputating" branch (v5.24.2):
// the tail is real content the user watched stream in — never dropped here.
// The tool-JSON jargon trimming stays server-side (it needs the tool-name
// registry); the client renderer gets System Action cards for that instead.
export function closeUnclosedFences(text) {
  const s = String(text || '')
  if (!hasUnclosedFence(s)) return s
  return s.endsWith('\n') ? `${s}\`\`\`` : `${s}\n\`\`\``
}

// Known failure-notice openers — the verbatim first words of every terminal
// error bubble the app itself produces (resume stall, interrupted-before-
// content, empty-reply fallback, network card). A notice is only recognised
// when the message is SHORT: a legitimate reply can happily begin with
// "Something went wrong with your CSS — here's the fix…", and that must
// never be deleted.
const FAILURE_OPENERS = [
  /^the response stopped progressing\b/i,
  /^the reply was interrupted before any content arrived\b/i,
  /^i couldn['’]?t generate a response for that\b/i,
  /^network error\b/i,
  /^something went wrong\b/i,
]
const NOTICE_MAX_LEN = 200

export function isFailureNotice(content) {
  const s = String(content || '').trim()
  if (!s || s.length > NOTICE_MAX_LEN) return false
  return FAILURE_OPENERS.some(re => re.test(s))
}

// Apply both repairs to one saved conversation:
//   • assistant failure notices and empty bubbles are dropped (the user
//     message stays, so the question can simply be re-asked)
//   • assistant replies with an unclosed fence get the missing ```
// User messages are never modified and never removed.
// Returns the new array plus counters so callers can skip the DB write
// when nothing changed.
export function cleanSessionMessages(messages) {
  if (!Array.isArray(messages)) return { messages, removed: 0, repaired: 0 }
  const out = []
  let removed = 0
  let repaired = 0
  for (const m of messages) {
    if (!m || typeof m !== 'object' || m.role !== 'assistant') { out.push(m); continue }
    const s = String(m.content || '')
    if (!s.trim() || isFailureNotice(s)) { removed++; continue }
    const fixed = closeUnclosedFences(s)
    if (fixed !== s) repaired++
    out.push(fixed === s ? m : { ...m, content: fixed })
  }
  return { messages: out, removed, repaired }
}

// Human/CI summary line for one session's cleaning pass.
export function sessionRepairSummary(sid, { removed, repaired }) {
  if (!removed && !repaired) return null
  const bits = []
  if (removed) bits.push(`${removed} dropped`)
  if (repaired) bits.push(`${repaired} fence-repaired`)
  return `${sid}: ${bits.join(', ')}`
}

// Re-export so the janitor and tests share one strip implementation with
// the action bar's quote flow (keeps "clean prose" consistent everywhere).
export { stripMarkdown }
