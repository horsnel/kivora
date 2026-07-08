-- ── Anonymous Daily Usage Tracking ──────────────────────────────
-- Tracks per-IP daily usage for anonymous (unregistered) visitors.
-- Used by lib/ratelimit.js → anonymousDailyLimit() to enforce:
--   • 15 explore/opportunities queries per day per IP
--   • 5 chat messages per day per IP
--
-- If this table doesn't exist, the rate limiter gracefully falls back
-- to the in-memory per-minute burst limit (less strict but still functional).

CREATE TABLE IF NOT EXISTS anon_daily_usage (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip          TEXT NOT NULL,
  action      TEXT NOT NULL,          -- 'explore' | 'chat' | 'opportunities'
  date        DATE NOT NULL,          -- UTC calendar date (YYYY-MM-DD)
  count       INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ip, action, date)
);

-- Index for fast lookups by IP + action + date
CREATE INDEX IF NOT EXISTS idx_anon_daily_usage_lookup
  ON anon_daily_usage (ip, action, date);

-- Index for cleanup queries (find old rows to delete)
CREATE INDEX IF NOT EXISTS idx_anon_daily_usage_date
  ON anon_daily_usage (date);

-- Enable Row Level Security (service role bypasses RLS)
ALTER TABLE anon_daily_usage ENABLE ROW LEVEL SECURITY;

-- No policies needed — only the service role key accesses this table,
-- which bypasses RLS entirely. Client-side access is not required.

-- Optional: Cron cleanup — delete rows older than 7 days
-- Run this in pg_cron or a Supabase scheduled function:
-- DELETE FROM anon_daily_usage WHERE date < CURRENT_DATE - INTERVAL '7 days';
