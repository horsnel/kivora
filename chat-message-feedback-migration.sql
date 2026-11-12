-- ─── Chat message feedback (v5.30.17, OPTIONAL since v5.30.20) ──
-- v5.30.20: thumbs now persist by default — they are embedded INSIDE the
-- messages jsonb (message objects carry a "feedback": "up"|"down" field),
-- which needs no migration; the server's read-then-append save path
-- preserves the embedded fields. This column is therefore OPTIONAL:
-- it adds a queryable per-index map ({ "3": "up", "7": "down" }) for
-- analytics/backup, and the client still merges it on read if present.
--
-- Indexes shift when a rerun truncates the tail, which the UI reflects by
-- design (a regenerated reply is a different answer and drops its old vote).
--
-- Idempotent. Run in: Supabase Dashboard → SQL Editor.
-- RLS note: chat_sessions policies are table-wide (`for all`), so the new
-- column is automatically covered — no policy changes needed.

alter table chat_sessions add column if not exists feedback jsonb not null default '{}'::jsonb;

comment on column chat_sessions.feedback is
  'Per-message thumbs from the chat action bar: {"<message index>": "up"|"down"} (v5.30.17)';
