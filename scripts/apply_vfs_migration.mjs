#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// apply_vfs_migration.mjs — Kivora Agent Workspace (v5.27)
// Creates public.agent_files + storage bucket 'agent-files' + RLS.
// Direct Postgres DDL (service connection) — run once.
// ════════════════════════════════════════════════════════════════════
import pg from 'pg'

const URL = 'postgresql://postgres:G1m%40s2neeef@db.asfzdbpfakwpiawhhrby.supabase.co:5432/postgres'

const DDL = [
  `create table if not exists public.agent_files (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    workspace text not null default 'default',
    path text not null,
    mime text not null default 'text/plain',
    size integer not null default 0,
    content text,
    storage_path text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, workspace, path)
  )`,
  `create index if not exists agent_files_user_ws on public.agent_files (user_id, workspace)`,
  `alter table public.agent_files enable row level security`,
  `drop policy if exists "agent_files_owner_all" on public.agent_files`,
  `create policy "agent_files_owner_all" on public.agent_files for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`,
  `insert into storage.buckets (id, name, public) values ('agent-files','agent-files', false) on conflict (id) do nothing`,
]

// sandbox lacks IPv6; direct db host is IPv6-only → session pooler (eu-west-1)
const client = new pg.Client({
  host: 'aws-0-eu-west-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.asfzdbpfakwpiawhhrby',
  password: 'G1m@s2neeef',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  for (const sql of DDL) {
    await client.query(sql)
    console.log('OK  ', sql.slice(0, 72).replace(/\s+/g, ' ') + '…')
  }
  const { rows } = await client.query(`select count(*)::int as n from public.agent_files`).catch(() => ({ rows: [{ n: 0 }] }))
  const bucket = await client.query(`select id from storage.buckets where id = 'agent-files'`)
  console.log(`\nmigration complete — agent_files rows: ${rows[0].n}, bucket present: ${bucket.rowCount === 1}`)
} finally {
  await client.end()
}
