-- ─── Chat session meta: rename + pin (v5.18) ────────────────────
-- Adds server-side persistence for the chat sidebar's Rename and Pin
-- actions. The client (app/chat/ChatClient.jsx) already attempts these
-- column writes and gracefully falls back to a device-local localStorage
-- mirror, so this migration is SAFE TO RUN AT ANY TIME — before it runs,
-- rename/pin work per-device; after it runs, they follow the account.
--
-- Idempotent. Run in: Supabase Dashboard → SQL Editor.
-- RLS note: chat_sessions policies are table-wide (`for all`), so the new
-- columns are automatically covered — no policy changes needed.

alter table chat_sessions add column if not exists title text;
alter table chat_sessions add column if not exists pinned boolean default false;
