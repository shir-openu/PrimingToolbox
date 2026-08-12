-- ================================================================================
-- CREATE TABLE: subliminal_results
-- For: PAIR_05_SUBLIMINAL - Subliminal Priming Paradigm
-- Date: 23 December 2025
-- ================================================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard → Your project → SQL Editor → New query
-- ================================================================================

CREATE TABLE IF NOT EXISTS subliminal_results (
    id BIGSERIAL PRIMARY KEY,
    experiment_type TEXT,
    experiment_id TEXT,
    participant_id TEXT,
    trial_number INTEGER,
    prime TEXT,
    target TEXT,
    relation TEXT,
    target_type TEXT,
    response TEXT,
    correct BOOLEAN,
    rt NUMERIC,
    prime_duration_ms INTEGER,
    forward_mask_ms INTEGER,
    backward_mask_ms INTEGER,
    experimenter_email TEXT,
    user_experiment_id TEXT,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (recommended for multi-experimenter setup)
ALTER TABLE subliminal_results ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anonymous users (for participants completing experiments)
CREATE POLICY "Allow anonymous inserts" ON subliminal_results
    FOR INSERT TO anon WITH CHECK (true);

-- Allow experimenters to see only their own data
CREATE POLICY "Experimenters see own data" ON subliminal_results
    FOR SELECT USING (experimenter_email = current_setting('request.jwt.claims', true)::json->>'email');

-- ================================================================================
-- OPTIONAL: Create index for faster queries by experimenter
-- ================================================================================
CREATE INDEX IF NOT EXISTS idx_subliminal_experimenter
    ON subliminal_results(experimenter_email, user_experiment_id);

CREATE INDEX IF NOT EXISTS idx_subliminal_participant
    ON subliminal_results(participant_id);
