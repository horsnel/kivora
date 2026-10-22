-- ─── Resumable streaming buffer (v5.20) ───────────────────────────
-- Server-side persistence for in-flight assistant generations. The chat
-- route upserts the growing reply here every ~600ms — if the client's
-- network drops mid-response, generation continues in the background
-- (ctx.waitUntil) and the client reconnects via GET /api/chat/resume to
-- receive the remaining AND already-generated content from this row.
--
-- Access model: written/read ONLY by the service role (chat API + resume
-- endpoint are the public surfaces). No client-facing RLS policies — the
-- table is invisible to anon/authenticated PostgREST clients.
--
-- Idempotent. Applied via: node scripts/run-supabase-sql.js chat-generations-migration.sql

create table if not exists chat_generations (
  id text primary key,
  user_id uuid,
  content text not null default '',
  seq bigint not null default 0,
  status text,
  done boolean not null default false,
  error jsonb,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_generations enable row level security;

drop policy if exists "service full chat_generations" on chat_generations;
create policy "service full chat_generations" on chat_generations
  for all using (auth.role() = 'service_role');

create index if not exists chat_generations_stale_idx on chat_generations (updated_at);
