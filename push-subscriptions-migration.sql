-- push-subscriptions-migration.sql — v5.22 Web Push backend storage
-- Idempotent. Run via scripts/run-supabase-sql.js with PGPASSWORD env set.
-- NOTE: comment lines must never contain the SQL statement terminator char.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push subs: own rows" on push_subscriptions;
create policy "push subs: own rows"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
