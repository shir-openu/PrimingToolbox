-- ================================================================================
-- CREATE ALL TABLES - PrimingHub
-- Date: 23 December 2025
-- ================================================================================
-- Run this ONCE in Supabase SQL Editor to create all required tables:
-- https://supabase.com/dashboard → Your project → SQL Editor → New query
-- ================================================================================

-- ================================================================================
-- TABLE 1: experiment_results
-- Used by: AMP, Semantic Priming, Number Priming
-- ================================================================================

CREATE TABLE IF NOT EXISTS experiment_results (
    id BIGSERIAL PRIMARY KEY,
    experiment_id TEXT,
    participant_id TEXT,
    trial_number INTEGER,
    response TEXT,
    rt NUMERIC,
    experimenter_email TEXT,
    user_experiment_id TEXT,
    external_id TEXT,
    prime_type TEXT,
    prime_id TEXT,
    prime_label TEXT,
    target TEXT,
    prime_word TEXT,
    target_word TEXT,
    target_type TEXT,
    condition TEXT,
    correct BOOLEAN,
    timeout BOOLEAN,
    soa INTEGER,
    prime TEXT,
    congruent BOOLEAN,
    correct_response TEXT,
    priming_mode TEXT,
    prime_duration INTEGER,
    reference_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON experiment_results
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Experimenters see own data" ON experiment_results
    FOR SELECT USING (experimenter_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE INDEX IF NOT EXISTS idx_experiment_results_experimenter
    ON experiment_results(experimenter_email, user_experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiment_results_participant
    ON experiment_results(participant_id);

-- ================================================================================
-- TABLE 2: ec_results
-- Used by: Evaluative Conditioning
-- ================================================================================

CREATE TABLE IF NOT EXISTS ec_results (
    id BIGSERIAL PRIMARY KEY,
    experiment_id TEXT,
    participant_id TEXT,
    phase TEXT,
    trial_number INTEGER,
    cs_id TEXT,
    cs_label TEXT,
    us_id TEXT,
    us_content TEXT,
    us_valence TEXT,
    repetition INTEGER,
    rating INTEGER,
    rt NUMERIC,
    experimenter_email TEXT,
    user_experiment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ec_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON ec_results
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Experimenters see own data" ON ec_results
    FOR SELECT USING (experimenter_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE INDEX IF NOT EXISTS idx_ec_results_experimenter
    ON ec_results(experimenter_email, user_experiment_id);

CREATE INDEX IF NOT EXISTS idx_ec_results_participant
    ON ec_results(participant_id);

-- ================================================================================
-- TABLE 3: subliminal_results
-- Used by: Subliminal Priming
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

ALTER TABLE subliminal_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON subliminal_results
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Experimenters see own data" ON subliminal_results
    FOR SELECT USING (experimenter_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE INDEX IF NOT EXISTS idx_subliminal_experimenter
    ON subliminal_results(experimenter_email, user_experiment_id);

CREATE INDEX IF NOT EXISTS idx_subliminal_participant
    ON subliminal_results(participant_id);

-- ================================================================================
-- DONE! All tables created.
-- ================================================================================
