#!/usr/bin/env node
// ── Kivora nightly janitor (v5.30.17) ────────────────────────────────
// Background cleanup agent for chat history. Runs daily from GitHub Actions
// (.github/workflows/janitor.yml) with SUPABASE_URL + SUPABASE_SERVICE_KEY
// (the same secrets the daily maintenance healthcheck already uses — no new
// credentials to provision). Also safe to run locally:
//
//   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/maintenance/janitor.mjs
//   DRY_RUN=1 …    # report what WOULD change without writing
//
// What it does, per conversation (deterministic rules only — the agent
// deliberately does NOT rewrite message bodies with an LLM; closing a fence
// or dropping a known failure notice cannot hallucinate):
//   1. Drops assistant messages that are failure notices or empty bubbles
//      ("The response stopped progressing…", interrupted-reply notices,
//      "I couldn't generate a response for that…" fallbacks). The user's
//      message stays, so the question can simply be re-asked.
//   2. Closes unclosed Markdown code fences on assistant replies — the same
//      "close, don't amputate" rule the chat API has applied to new replies
//      since v5.24.2, now also healing rows saved before that existed.
//   3. Purges stale chat_generations buffer rows (older than 7 days) — they
//      are resume scaffolding, not user-visible history, and used to grow
//      forever.
//
// Never touches user messages. Caps its writes per run so a first pass over
// a large DB can't hammer PostgREST. Exit 0 even when it fixed things; exit
// 1 only when the scan itself failed (so Actions can open an issue).

import { createClient } from '@supabase/supabase-js'
import { closeUnclosedFences, isFailureNotice } from '../../lib/textRepair.js'

const DRY_RUN = process.env.DRY_RUN === '1'
const PAGE = 200
const MAX_SESSIONS = 5000          // hard scan ceiling per run
const MAX_SESSION_WRITES = 400     // repairs per run — rest wait for tomorrow
const STALE_BUFFER_DAYS = 7

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('janitor: SUPABASE_URL and SUPABASE_SERVICE_KEY are required')
  process.exit(1)
}
const supa = createClient(url, key, { auth: { persistSession: false } })

// One conversation's cleanup pass. Mirrors cleanSessionMessages semantics
// without importing it — the janitor must stay standalone (CI has no bundler),
// so keep these two implementations in lockstep with the battery tests.
function cleanMessages(messages) {
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

async function cleanSessions() {
  const report = { scanned: 0, changed: 0, written: 0, droppedNotices: 0, closedFences: 0, details: [], errors: 0 }
  let offset = 0
  while (report.scanned < MAX_SESSIONS) {
    const { data, error } = await supa
      .from('chat_sessions')
      .select('id, messages')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) { report.errors++; report.details.push(`scan: ${error.message}`); break }
    if (!data || data.length === 0) break
    for (const row of data) {
      report.scanned++
      const before = Array.isArray(row.messages) ? row.messages.length : 0
      const { messages, removed, repaired } = cleanMessages(row.messages)
      const after = Array.isArray(messages) ? messages.length : 0
      if (removed || repaired) {
        report.changed++
        report.droppedNotices += removed
        report.closedFences += repaired
        if (!DRY_RUN && report.written < MAX_SESSION_WRITES) {
          const { error: upErr } = await supa
            .from('chat_sessions')
            .update({ messages })
            .eq('id', row.id)
          if (upErr) { report.errors++; report.details.push(`${row.id}: ${upErr.message}`) }
          else report.written++
        }
        if (report.details.length < 25) {
          report.details.push(`${row.id}: ${removed} dropped, ${repaired} fence-repaired (${before}→${after} msgs)`)
        }
      }
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return report
}

async function purgeStaleBuffers() {
  const cutoff = new Date(Date.now() - STALE_BUFFER_DAYS * 24 * 3600 * 1000).toISOString()
  const { data, error } = await supa
    .from('chat_generations')
    .select('id')
    .lt('updated_at', cutoff)
    .limit(1000)
  if (error) return { purged: 0, error: error.message }
  if (!data?.length) return { purged: 0 }
  if (DRY_RUN) return { purged: data.length }
  const ids = data.map(r => r.id)
  const { error: delErr } = await supa
    .from('chat_generations')
    .delete()
    .in('id', ids)
  return delErr ? { purged: 0, error: delErr.message } : { purged: ids.length }
}

const t0 = Date.now()
const sessions = await cleanSessions()
const buffers = await purgeStaleBuffers()
const summary = {
  dry_run: DRY_RUN,
  duration_ms: Date.now() - t0,
  sessions: sessions,
  stale_generations: buffers,
}

console.log('── Kivora nightly janitor ──')
console.log(JSON.stringify(summary, null, 2))
if (sessions.errors > 0) process.exit(1)
