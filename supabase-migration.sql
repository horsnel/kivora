-- Kivora Platform — Run this in your Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New query

-- ─── Profiles ────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Saved Results ────────────────────────────────────────────

create table if not exists saved_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  query text,
  result_slug text,
  created_at timestamptz default now()
);

-- ─── Explore Cache (Core Table) ───────────────────────────────

create table if not exists explore_cache (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  query text not null,
  category text,
  result jsonb not null,
  views int default 1,
  created_at timestamptz default now()
);

-- ─── Chat Sessions ────────────────────────────────────────────

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Wiki Tables ──────────────────────────────────────────────

create table if not exists wiki_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content text not null,
  updated_at timestamptz default now()
);

create index if not exists wiki_pages_content_search
  on wiki_pages using gin(to_tsvector('english', title || ' ' || content));

create table if not exists wiki_index (
  id int primary key default 1,
  content text not null,
  updated_at timestamptz default now()
);

create table if not exists wiki_log (
  id int primary key default 1,
  content text not null default '',
  updated_at timestamptz default now()
);

-- ─── Exchange Rates ───────────────────────────────────────────

create table if not exists exchange_rates (
  id int primary key default 1,
  rates jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────

alter table profiles enable row level security;
alter table saved_results enable row level security;
alter table chat_sessions enable row level security;
alter table explore_cache enable row level security;
alter table wiki_pages enable row level security;
alter table wiki_index enable row level security;
alter table wiki_log enable row level security;
alter table exchange_rates enable row level security;

-- Public can read explore_cache and exchange_rates
create policy "public read explore_cache"
  on explore_cache for select using (true);
create policy "service write explore_cache"
  on explore_cache for all using (auth.role() = 'service_role');

create policy "public read exchange_rates"
  on exchange_rates for select using (true);
create policy "service write exchange_rates"
  on exchange_rates for all using (auth.role() = 'service_role');

-- Users own their profiles and saves
create policy "users own profile"
  on profiles for all using (auth.uid() = id);
create policy "service full profiles"
  on profiles for all using (auth.role() = 'service_role');

create policy "users own saves"
  on saved_results for all using (auth.uid() = user_id);
create policy "service full saves"
  on saved_results for all using (auth.role() = 'service_role');

create policy "users own chats"
  on chat_sessions for all using (auth.uid() = user_id);
create policy "service full chats"
  on chat_sessions for all using (auth.role() = 'service_role');

-- Wiki is service-only
create policy "service only wiki_pages"
  on wiki_pages for all using (auth.role() = 'service_role');
create policy "service only wiki_index"
  on wiki_index for all using (auth.role() = 'service_role');
create policy "service only wiki_log"
  on wiki_log for all using (auth.role() = 'service_role');

-- ─── Onboarding columns (add to existing profiles table) ──────
alter table profiles add column if not exists onboarding_done boolean default false;
alter table profiles add column if not exists onboarding_goal text;
alter table profiles add column if not exists onboarding_experience text;
alter table profiles add column if not exists onboarding_location text;
alter table profiles add column if not exists onboarding_interests text[] default '{}';

-- Install Supabase Auth Helpers for middleware support
-- Run: npm install @supabase/auth-helpers-nextjs

-- ─── Contact Submissions ──────────────────────────────────────

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  subject text default 'General question',
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table contact_submissions enable row level security;

create policy "service only contact_submissions"
  on contact_submissions for all using (auth.role() = 'service_role');

-- ─── Page Views (Privacy-first Analytics) ─────────────────────

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text default '',
  created_at timestamptz default now()
);

alter table page_views enable row level security;

create policy "public insert page_views"
  on page_views for insert with check (true);

create policy "service only page_views"
  on page_views for select using (auth.role() = 'service_role');

-- Index for analytics queries
create index if not exists page_views_path_idx on page_views (path);
create index if not exists page_views_created_idx on page_views (created_at);

-- ─── Research Reports (per-user saved reports) ────────────────
-- Stores full research reports for logged-in users (Supabase-backed).
-- localStorage is used as a quick cache for the most recent 20 reports
-- (anonymously); this table is the authoritative store for logged-in users.

create table if not exists research_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  query text not null,
  mode text default 'quick',
  apex_model text default 'apex-free',
  title text,
  report text,
  sources jsonb default '[]',
  followups jsonb default '[]',
  wiki_page_id uuid,
  wiki_lifecycle text default 'draft',
  wiki_slug text,
  wiki_version int default 0,
  created_at timestamptz default now()
);

alter table research_reports enable row level security;

create policy "users own research_reports"
  on research_reports for all using (auth.uid() = user_id);
create policy "service full research_reports"
  on research_reports for all using (auth.role() = 'service_role');

create index if not exists research_reports_user_idx
  on research_reports (user_id, created_at desc);

-- ─── APEX Research Cache (cross-user cache, service-only) ─────
-- Used by /api/research to deduplicate identical queries across users.

create table if not exists apex_research_cache (
  id uuid primary key default gen_random_uuid(),
  query_text text not null,
  normalized_query text not null,
  query_hash text not null,
  report text,
  sources text,
  followups text,
  verification_summary text,
  mode text,
  apex_tier text,
  original_latency_ms int,
  cache_hit_count int default 0,
  is_hot boolean default false,
  expires_at timestamptz,
  last_accessed_at timestamptz default now(),
  wiki_page_id uuid,
  created_at timestamptz default now()
);

alter table apex_research_cache enable row level security;
create policy "service only apex_research_cache"
  on apex_research_cache for all using (auth.role() = 'service_role');

create unique index if not exists apex_research_cache_hash_mode_tier_idx
  on apex_research_cache (query_hash, mode, apex_tier);
create index if not exists apex_research_cache_expires_idx
  on apex_research_cache (expires_at);

-- ─── APEX Wiki Pages (richer wiki with lifecycle) ─────────────
-- Used by the research worker to track wiki page lifecycle states.

create table if not exists apex_wiki_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content text,
  lifecycle text default 'draft',  -- draft | active | stale | contradicted | archived
  version int default 0,
  sources jsonb default '[]',
  last_verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table apex_wiki_pages enable row level security;
create policy "service only apex_wiki_pages"
  on apex_wiki_pages for all using (auth.role() = 'service_role');

create index if not exists apex_wiki_pages_content_search
  on apex_wiki_pages using gin(to_tsvector('english', title || ' ' || coalesce(content, '')));

-- ─── Study Sessions ───────────────────────────────────────────
-- Tracks study tool usage sessions (homework, essay, etc.)

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  tool_type text not null,
  subject text,
  query text,
  created_at timestamptz default now(),
  follow_up_count int default 0
);

alter table study_sessions enable row level security;
create policy "users own study_sessions"
  on study_sessions for all using (auth.uid() = user_id);
create policy "service full study_sessions"
  on study_sessions for all using (auth.role() = 'service_role');

create index if not exists study_sessions_user_idx
  on study_sessions (user_id, created_at desc);
