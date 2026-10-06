-- ── Community attachments migration ────────────────────────────────
-- Adds an `attachments` jsonb column to forum posts and replies so
-- images and file attachments can be shared in the community.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor).
-- Safe to re-run (idempotent via IF NOT EXISTS).
--
-- Attachment shape stored per post/reply:
--   [{ "url": "<storage public url>", "name": "photo.jpg",
--      "size": 123456, "type": "image/jpeg", "kind": "image|file" }]
-- Files themselves live in the public Storage bucket `community-media`
-- (created automatically by the /api/forum/upload route).

ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
