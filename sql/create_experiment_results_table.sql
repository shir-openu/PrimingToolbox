-- ================================================================================
-- CREATE TABLE: experiment_results
-- For: AMP, Semantic Priming, Number Priming paradigms
-- Date: 23 December 2025
-- ================================================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard → Your project → SQL Editor → New query
-- ================================================================================

CREATE TABLE IF NOT EXISTS experiment_results (
    id BIGSERIAL PRIMARY KEY,

    -- Common fields (all paradigms)
    experiment_id TEXT,
    participant_id TEXT,
    trial_number INTEGER,
    response TEXT,
    rt NUMERIC,
    experimenter_email TEXT,
    user_experiment_id TEXT,
    external_id TEXT,

    -- AMP-specific fields
    prime_type TEXT,
    prime_id TEXT,
    prime_label TEXT,
    target TEXT,

    -- Semantic Priming-specific fields
    prime_word TEXT,
    target_word TEXT,
    target_type TEXT,
    condition TEXT,
    correct BOOLEAN,
    timeout BOOLEAN,
    soa INTEGER,

    -- Number Priming-specific fields
    prime TEXT,
    congruent BOOLEAN,
    correct_response TEXT,
    priming_mode TEXT,
    prime_duration INTEGER,
    reference_number INTEGER,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anonymous users (participants)
CREATE POLICY "Allow anonymous inserts" ON experiment_results
    FOR INSERT TO anon WITH CHECK (true);

-- Allow experimenters to see their own data
CREATE POLICY "Experimenters see own data" ON experiment_results
    FOR SELECT USING (experimenter_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_experiment_results_experimenter
    ON experiment_results(experimenter_email, user_experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiment_results_participant
    ON experiment_results(participant_id);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment
    ON experiment_results(experiment_id);
