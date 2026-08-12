-- ================================================================================
-- CREATE TABLE: ec_results
-- For: PAIR_04_EVALUATIVE - Evaluative Conditioning paradigm
-- Date: 23 December 2025
-- ================================================================================
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard → Your project → SQL Editor → New query
-- ================================================================================

CREATE TABLE IF NOT EXISTS ec_results (
    id BIGSERIAL PRIMARY KEY,

    -- Experiment identifiers
    experiment_id TEXT,
    participant_id TEXT,

    -- Trial info
    phase TEXT,                    -- 'learning' or 'test'
    trial_number INTEGER,

    -- Stimulus info
    cs_id TEXT,                    -- Conditioned Stimulus ID
    cs_label TEXT,                 -- Conditioned Stimulus label
    us_id TEXT,                    -- Unconditioned Stimulus ID
    us_content TEXT,               -- Unconditioned Stimulus content
    us_valence TEXT,               -- 'positive', 'negative', 'neutral'
    repetition INTEGER,            -- Which repetition of CS-US pairing

    -- Response data
    rating INTEGER,                -- Likert rating (e.g., 1-7)
    rt NUMERIC,                    -- Response time in ms

    -- Experimenter info
    experimenter_email TEXT,
    user_experiment_id TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE ec_results ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anonymous users (participants)
CREATE POLICY "Allow anonymous inserts" ON ec_results
    FOR INSERT TO anon WITH CHECK (true);

-- Allow experimenters to see their own data
CREATE POLICY "Experimenters see own data" ON ec_results
    FOR SELECT USING (experimenter_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ec_results_experimenter
    ON ec_results(experimenter_email, user_experiment_id);

CREATE INDEX IF NOT EXISTS idx_ec_results_participant
    ON ec_results(participant_id);

CREATE INDEX IF NOT EXISTS idx_ec_results_experiment
    ON ec_results(experiment_id);

CREATE INDEX IF NOT EXISTS idx_ec_results_phase
    ON ec_results(phase);
