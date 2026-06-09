-- Kivora Platform — Colab Sessions Migration
-- Run this in your Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New query

-- ─── Colab Sessions ───────────────────────────────────────────
-- Tracks user Colab GPU/TPU sessions for persistence and history

create table if not exists colab_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_name text not null,
  session_id text not null,
  accelerator text default 'T4',
  status text default 'active',
  created_at timestamptz default now(),
  stopped_at timestamptz
);

-- Unique constraint: one active session per session_id per user
create unique index if not exists colab_sessions_session_id_idx
  on colab_sessions (session_id);

-- Quick lookup: find all sessions for a user
create index if not exists colab_sessions_user_id_idx
  on colab_sessions (user_id);

-- Quick lookup: find active sessions
create index if not exists colab_sessions_status_idx
  on colab_sessions (status) where status = 'active';

-- ─── Row Level Security ───────────────────────────────────────

alter table colab_sessions enable row level security;

-- Users can only see their own sessions
create policy "users own colab sessions"
  on colab_sessions for all using (auth.uid() = user_id);

-- Service role has full access (used by API routes with service_role key)
create policy "service full colab sessions"
  on colab_sessions for all using (auth.role() = 'service_role');
