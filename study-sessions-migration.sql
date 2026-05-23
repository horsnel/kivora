-- Migration: study_sessions table
-- Tracks user engagement with StudyDesk, DevTools, and Chat for learning analytics
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_type TEXT NOT NULL,           -- 'homework','essay','research','citation','coding','code_explainer','regex','json_formatter','readme','sql_builder','api_analyzer','chat'
  subject TEXT,                       -- e.g. 'Mathematics', 'JavaScript', null for chat
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  result_copied BOOLEAN DEFAULT false,
  follow_up_asked BOOLEAN DEFAULT false,
  input_summary TEXT,                 -- brief summary of what was asked (first 200 chars)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_at ON study_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_tool_type ON study_sessions(tool_type);

-- RLS: users can only read/write their own sessions
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own study sessions"
  ON study_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study sessions"
  ON study_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study sessions"
  ON study_sessions FOR UPDATE
  USING (auth.uid() = user_id);
