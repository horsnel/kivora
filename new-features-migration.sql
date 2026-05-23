-- Kivora Platform — New Features Migration
-- Run this in your Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New query

-- ─── Profile extensions ──────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean default false;

-- ─── Forum posts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  author_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Forum replies ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  author_name text,
  created_at timestamptz DEFAULT now()
);

-- ─── Row Level Security ─────────────────────────────────────
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read forum_posts" ON forum_posts FOR SELECT USING (true);
CREATE POLICY "auth insert forum_posts" ON forum_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users own forum_posts" ON forum_posts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "public read forum_replies" ON forum_replies FOR SELECT USING (true);
CREATE POLICY "auth insert forum_replies" ON forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users own forum_replies" ON forum_replies FOR ALL USING (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS forum_posts_created_idx ON forum_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS forum_replies_post_idx ON forum_replies (post_id);
