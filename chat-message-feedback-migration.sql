-- ─── Chat message feedback (v5.30.17) ───────────────────────────
-- Persists the 👍/👎 that the message action bar writes on assistant
-- replies. Keyed by message index inside the session's messages array:
--
--   feedback = { "3": "up", "7": "down" }
--
-- The client (app/chat/ChatClient.jsx) writes the whole map through its
-- existing persistSessionMeta path and gracefully falls back to the
-- device-local localStorage mirror, so this migration is SAFE TO RUN AT ANY
-- TIME — before it runs, thumbs are per-device; after it runs, they follow
-- the account across devices.
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
