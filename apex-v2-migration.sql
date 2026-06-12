-- ═══════════════════════════════════════════════════════════════════
-- APEX 2.0 — LLM Wiki + Page Lifecycle + Hot Cache + SciMem
-- Run this in your Supabase SQL Editor after the base migration
-- ═══════════════════════════════════════════════════════════════════

-- ─── APEX Wiki Pages (with Lifecycle) ──────────────────────────
-- The core of the LLM Wiki pattern:
--   Raw sources (immutable) → Wiki (LLM-compiled) → Schema (config)
-- Page lifecycle: draft → active → stale → contradicted → archived

create table if not exists apex_wiki_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content text not null default '',
  
  -- Page lifecycle (Synthadoc)
  -- draft: just created, not yet verified
  -- active: verified, currently accurate
  -- stale: needs refresh (older than stale_threshold)
  -- contradicted: newer sources contradict this page
  -- archived: no longer maintained
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'active', 'stale', 'contradicted', 'archived')),
  
  -- Metadata
  topic text not null default '',
  category text not null default 'general',  -- academic, biomedical, tech, finance, general
  depth text not null default 'quick',         -- quick, thorough
  
  -- Source quality summary
  source_count int not null default 0,
  p1_count int not null default 0,
  p2_count int not null default 0,
  p3_count int not null default 0,
  
  -- Verification summary
  epistemic_summary jsonb not null default '{}',  -- {established: N, tentative: N, contested: N, speculative: N}
  confidence_score float not null default 0.0,     -- 0.0-1.0 overall confidence
  
  -- Temporal metadata
  earliest_source_date timestamptz,
  latest_source_date timestamptz,
  stale_after_days int not null default 90,  -- Days before page becomes stale
  
  -- Version tracking
  version int not null default 1,
  parent_version_id uuid references apex_wiki_pages(id),
  
  -- Compilation metadata
  compiled_by text not null default 'apex',  -- apex, manual, import
  compilation_model text not null default '',  -- Which LLM compiled this
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  access_count int not null default 0
);

-- Full-text search index
create index if not exists apex_wiki_pages_search
  on apex_wiki_pages using gin(to_tsvector('english', title || ' ' || content || ' ' || topic));

-- Lifecycle index for stale detection
create index if not exists apex_wiki_pages_lifecycle_idx
  on apex_wiki_pages (lifecycle, last_verified_at);

-- Category index
create index if not exists apex_wiki_pages_category_idx
  on apex_wiki_pages (category);

-- Slug lookup
create index if not exists apex_wiki_pages_slug_idx
  on apex_wiki_pages (slug);


-- ─── APEX Wiki Sources (Raw, Immutable) ───────────────────────
-- Raw sources that were used to compile a wiki page.
-- These are IMMUTABLE — they never change after insertion.
-- This is the "Raw → Wiki" part of the LLM Wiki pattern.

create table if not exists apex_wiki_sources (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references apex_wiki_pages(id) on delete cascade,
  
  -- Source identification
  url text not null,
  title text not null default '',
  snippet text not null default '',
  full_content text,  -- Full scraped content (if available)
  
  -- Source classification
  source_name text not null default '',  -- e.g., "Semantic Scholar", "Crossref"
  source_tier text not null default 'UNV' check (source_tier in ('P1', 'P2', 'P3', 'UNV')),
  source_category text not null default 'web',  -- academic, biomedical, web, code, news, etc.
  
  -- Source metadata
  authors text[] default '{}',
  published_date timestamptz,
  doi text,
  
  -- Quality metrics
  relevance_score float not null default 0.0,
  adjusted_score float not null default 0.0,  -- After temporal decay
  
  -- Immutability flag
  is_immutable boolean not null default true,
  
  -- Timestamps
  ingested_at timestamptz not null default now()
);

-- Index for page→sources lookup
create index if not exists apex_wiki_sources_page_idx
  on apex_wiki_sources (page_id);

-- URL dedup index
create index if not exists apex_wiki_sources_url_idx
  on apex_wiki_sources (url);

-- Tier filter
create index if not exists apex_wiki_sources_tier_idx
  on apex_wiki_sources (source_tier);


-- ─── APEX Research Cache (Hot Cache / Claude-Obsidian) ────────
-- Session continuity: caches research results for instant recall.
-- Hot items are loaded on session start for continuity.

create table if not exists apex_research_cache (
  id uuid primary key default gen_random_uuid(),
  
  -- Query identification
  query_hash text not null,  -- SHA-256 hash of normalized query
  query_text text not null,
  normalized_query text not null,  -- Lowercased, trimmed, deduplicated
  
  -- Research result
  mode text not null default 'quick',  -- quick, thorough
  apex_tier text not null default 'apex-free',  -- apex-free, apex-premium
  
  -- Cached data
  report text not null default '',
  sources jsonb not null default '[]',
  followups jsonb not null default '[]',
  verification_summary jsonb not null default '{}',
  
  -- Performance
  original_latency_ms int not null default 0,
  cache_hit_count int not null default 0,
  
  -- Cache status
  is_hot boolean not null default false,  -- Hot cache = loaded on session start
  is_stale boolean not null default false,
  
  -- Wiki linkage
  wiki_page_id uuid references apex_wiki_pages(id),
  
  -- User association (null = global cache)
  user_id uuid references profiles(id) on delete set null,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  last_accessed_at timestamptz not null default now()
);

-- Query hash lookup (O(1) cache hits)
create unique index if not exists apex_research_cache_hash_idx
  on apex_research_cache (query_hash, mode, apex_tier);

-- Hot cache index
create index if not exists apex_research_cache_hot_idx
  on apex_research_cache (is_hot, user_id) where is_hot = true;

-- Expiry index
create index if not exists apex_research_cache_expires_idx
  on apex_research_cache (expires_at);

-- User's recent queries
create index if not exists apex_research_cache_user_idx
  on apex_research_cache (user_id, last_accessed_at desc);


-- ─── APEX Claim Verifications ─────────────────────────────────
-- Persists claim verification results for the Verification Loop.

create table if not exists apex_claim_verifications (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references apex_wiki_pages(id) on delete cascade,
  
  -- Claim
  claim_text text not null,
  claim_hash text not null,  -- SHA-256 hash for dedup
  
  -- Verification result
  epistemic_status text not null check (epistemic_status in 
    ('ESTABLISHED', 'TENTATIVE', 'ACTIVE_DEBATE', 'SPECULATIVE', 'UNVERIFIED')),
  confidence float not null default 0.0,
  evidence_type text not null default '',  -- RCT, meta-analysis, cohort, etc.
  
  -- Supporting & conflicting sources
  supporting_sources jsonb not null default '[]',
  conflicting_sources jsonb not null default '[]',
  
  -- Sample metadata
  sample_size int,
  study_year int,
  
  -- Timestamps
  verified_at timestamptz not null default now()
);

-- Claim hash dedup
create unique index if not exists apex_claim_verifications_hash_idx
  on apex_claim_verifications (claim_hash);

-- Page→claims lookup
create index if not exists apex_claim_verifications_page_idx
  on apex_claim_verifications (page_id);

-- Epistemic status filter
create index if not exists apex_claim_verifications_status_idx
  on apex_claim_verifications (epistemic_status);


-- ─── APEX Source Provenance ───────────────────────────────────
-- Tracks where each piece of information came from (SciMem).

create table if not exists apex_source_provenance (
  id uuid primary key default gen_random_uuid(),
  
  -- Source reference
  source_url text not null,
  source_title text not null default '',
  source_tier text not null default 'UNV',
  
  -- What this source contributed
  contributed_to_type text not null check (contributed_to_type in 
    ('wiki_page', 'claim', 'cache_entry')),
  contributed_to_id uuid not null,  -- FK to the relevant table
  
  -- Provenance chain
  found_by_query text not null default '',  -- What query found this source
  found_by_source text not null default '',  -- Which search source found it
  found_at_depth int not null default 0,  -- 0 = initial, 1+ = iterative cycle
  
  -- Conflict detection
  contradicts_source_url text,  -- If this source contradicts another
  conflict_type text,  -- 'direct', 'methodological', 'temporal', 'scope'
  conflict_notes text,
  
  -- Retraction tracking
  is_retracted boolean not null default false,
  retraction_notice_url text,
  retracted_at timestamptz,
  
  -- Timestamps
  recorded_at timestamptz not null default now()
);

-- Source URL lookup
create index if not exists apex_source_provenance_url_idx
  on apex_source_provenance (source_url);

-- Contributed-to lookup
create index if not exists apex_source_provenance_contrib_idx
  on apex_source_provenance (contributed_to_type, contributed_to_id);

-- Conflict tracking
create index if not exists apex_source_provenance_conflict_idx
  on apex_source_provenance (contradicts_source_url) where contradicts_source_url is not null;

-- Retraction tracking
create index if not exists apex_source_provenance_retraction_idx
  on apex_source_provenance (is_retracted) where is_retracted = true;


-- ─── APEX Wiki Dialogue (Dialogic Wiki) ───────────────────────
-- Interactive dialogue around wiki topics — allows users to ask
-- follow-up questions, challenge claims, and explore debates.

create table if not exists apex_wiki_dialogue (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references apex_wiki_pages(id) on delete cascade,
  
  -- Dialogue participant
  user_id uuid references profiles(id) on delete set null,
  role text not null check (role in ('user', 'apex', 'reviewer')),
  
  -- Message content
  message text not null,
  message_type text not null default 'question' check (message_type in 
    ('question', 'answer', 'challenge', 'correction', 'clarification', 'debate', 'summary')),
  
  -- Linked claims
  referenced_claims jsonb not null default '[]',  -- [{claim_id, action: 'support'|'challenge'|'clarify'}]
  
  -- AI-generated metadata
  intent text not null default '',  -- 'verify', 'explore', 'challenge', 'deepen'
  
  -- Timestamps
  created_at timestamptz not null default now()
);

-- Page→dialogue lookup
create index if not exists apex_wiki_dialogue_page_idx
  on apex_wiki_dialogue (page_id, created_at);

-- User dialogue history
create index if not exists apex_wiki_dialogue_user_idx
  on apex_wiki_dialogue (user_id, created_at desc);


-- ─── APEX Wiki Edit Log (Concurrency Safety) ─────────────────
-- Tracks all edits for conflict resolution and audit trail.

create table if not exists apex_wiki_edit_log (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references apex_wiki_pages(id) on delete cascade,
  
  -- Edit metadata
  editor text not null default 'apex',  -- apex, user_id, system
  edit_type text not null check (edit_type in 
    ('create', 'update', 'lifecycle_change', 'source_add', 'source_remove', 
     'claim_update', 'retraction', 'merge', 'conflict_resolution')),
  
  -- Before/after diff
  field_changed text not null default '',  -- Which field changed
  old_value text,
  new_value text,
  
  -- Concurrency
  base_version int not null,  -- Version this edit was based on
  result_version int not null,  -- Version after this edit
  
  -- Timestamps
  edited_at timestamptz not null default now()
);

-- Page→edits lookup
create index if not exists apex_wiki_edit_log_page_idx
  on apex_wiki_edit_log (page_id, edited_at desc);

-- Concurrency conflict detection
create index if not exists apex_wiki_edit_log_version_idx
  on apex_wiki_edit_log (page_id, base_version, result_version);


-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

alter table apex_wiki_pages enable row level security;
alter table apex_wiki_sources enable row level security;
alter table apex_research_cache enable row level security;
alter table apex_claim_verifications enable row level security;
alter table apex_source_provenance enable row level security;
alter table apex_wiki_dialogue enable row level security;
alter table apex_wiki_edit_log enable row level security;

-- Wiki pages: service_role full access, public read (active pages only)
create policy "service full apex_wiki_pages"
  on apex_wiki_pages for all using (auth.role() = 'service_role');
create policy "public read active apex_wiki_pages"
  on apex_wiki_pages for select using (lifecycle in ('active', 'stale') or true);

-- Wiki sources: service_role full access, public read
create policy "service full apex_wiki_sources"
  on apex_wiki_sources for all using (auth.role() = 'service_role');
create policy "public read apex_wiki_sources"
  on apex_wiki_sources for select using (true);

-- Research cache: users own their cache, service full access
create policy "service full apex_research_cache"
  on apex_research_cache for all using (auth.role() = 'service_role');
create policy "users own cache"
  on apex_research_cache for all using (auth.uid() = user_id or user_id is null);

-- Claim verifications: service full, public read
create policy "service full apex_claim_verifications"
  on apex_claim_verifications for all using (auth.role() = 'service_role');
create policy "public read apex_claim_verifications"
  on apex_claim_verifications for select using (true);

-- Source provenance: service full, public read
create policy "service full apex_source_provenance"
  on apex_source_provenance for all using (auth.role() = 'service_role');
create policy "public read apex_source_provenance"
  on apex_source_provenance for select using (true);

-- Wiki dialogue: users can insert, service full
create policy "service full apex_wiki_dialogue"
  on apex_wiki_dialogue for all using (auth.role() = 'service_role');
create policy "users insert dialogue"
  on apex_wiki_dialogue for insert with check (auth.uid() = user_id);
create policy "users read dialogue"
  on apex_wiki_dialogue for select using (true);

-- Edit log: service only
create policy "service only apex_wiki_edit_log"
  on apex_wiki_edit_log for all using (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-mark pages as stale when they haven't been verified recently
create or replace function mark_stale_wiki_pages()
returns int as $$
declare
  updated_count int;
begin
  update apex_wiki_pages
  set lifecycle = 'stale',
      updated_at = now()
  where lifecycle = 'active'
    and last_verified_at < now() - (stale_after_days || ' days')::interval
    and last_verified_at is not null;
  
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$ language plpgsql security definer;

-- Get wiki page with all sources and verification
create or replace function get_wiki_page_full(p_slug text)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'page', row_to_json(p.*),
    'sources', coalesce(
      (select jsonb_agg(row_to_json(s.*))
       from apex_wiki_sources s where s.page_id = p.id),
      '[]'::jsonb
    ),
    'claims', coalesce(
      (select jsonb_agg(row_to_json(c.*))
       from apex_claim_verifications c where c.page_id = p.id),
      '[]'::jsonb
    ),
    'provenance', coalesce(
      (select jsonb_agg(row_to_json(pr.*))
       from apex_source_provenance pr 
       where pr.contributed_to_type = 'wiki_page' and pr.contributed_to_id = p.id),
      '[]'::jsonb
    )
  ) into result
  from apex_wiki_pages p
  where p.slug = p_slug;
  
  -- Update access count
  update apex_wiki_pages
  set access_count = access_count + 1,
      last_accessed_at = now()
  where slug = p_slug;
  
  return result;
end;
$$ language plpgsql security definer;

-- Clean expired cache entries
create or replace function clean_expired_cache()
returns int as $$
declare
  deleted_count int;
begin
  delete from apex_research_cache where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;

-- Get hot cache for a user (session continuity)
create or replace function get_hot_cache(p_user_id uuid)
returns table(
  id uuid,
  query_text text,
  mode text,
  report text,
  sources jsonb,
  followups jsonb,
  created_at timestamptz
) as $$
select c.id, c.query_text, c.mode, c.report, c.sources, c.followups, c.created_at
from apex_research_cache c
where c.is_hot = true
  and (c.user_id = p_user_id or c.user_id is null)
  and c.expires_at > now()
order by c.last_accessed_at desc
limit 10;
$$ language sql security definer;
