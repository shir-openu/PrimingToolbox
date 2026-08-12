-- ============================================================================
-- experiment_results: the columns the shared trial engine has always sent,
-- and this table has never had.
--
-- Found 2026-08-12, with the database healthy and reachable. PTA.Engine's
-- saveResults sends `experiment_name` and `timestamp` on every generic trial,
-- and `word` as well on Stroop trials. None of the three is a column here, so
-- PostgREST rejected the whole insert with PGRST204:
--
--     Could not find the 'experiment_name' column of 'experiment_results'
--     in the schema cache
--
-- A rejected insert is the ENTIRE run, not one field. So the generic engine -
-- the path every ?config= participant link and every Build-From-Scratch design
-- takes - had never once stored a row. The individual paradigm modules
-- (stroop.js, semantic.js, amp.js, ...) build different column sets and were
-- unaffected, which is why this table still filled with 241 pilot rows and the
-- failure stayed invisible.
--
-- js/core_fab.js now drops an unknown column and retries rather than losing the
-- run, so the platform works without this file. But dropping means the value is
-- not stored. Run this to actually keep it.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   https://supabase.com/dashboard/project/luhgdmzksitdkbysdfbr/sql
--
-- Safe to run more than once: every statement is IF NOT EXISTS.
-- ============================================================================

-- The experiment's human-readable name. The table has experiment_id and
-- user_experiment_id, both identifiers; nothing carried the name a participant
-- actually saw on screen, which is what you need when reading the data back.
alter table public.experiment_results
  add column if not exists experiment_name text;

-- When the trial happened, as recorded by the participant's browser.
-- NOT the same as created_at: created_at is when the row reached the server,
-- which for a batched save is one timestamp for the whole run. This is per
-- trial, and it is what lets you reconstruct the actual sequence and spot a
-- participant who walked away in the middle.
alter table public.experiment_results
  add column if not exists trial_timestamp timestamptz;

-- The Stroop stimulus word as displayed. word_meaning holds the colour the word
-- NAMES; this holds the string that was on screen, which differ once the
-- experiment runs in a language other than English.
alter table public.experiment_results
  add column if not exists word text;

-- Reading the data back by experiment is the common query and there is no index
-- for it yet.
create index if not exists experiment_results_experiment_id_idx
  on public.experiment_results (experiment_id);

create index if not exists experiment_results_experimenter_idx
  on public.experiment_results (experimenter_email, user_experiment_id);


-- ----------------------------------------------------------------------------
-- Clean-up: rows written by the 2026-08-12 connection probes.
--
-- Verifying that anon could still INSERT after you restored the project meant
-- actually inserting. anon has no DELETE policy on this table, so I could not
-- remove them myself. Three rows, all clearly marked. Run this to remove them.
-- ----------------------------------------------------------------------------
delete from public.experiment_results
 where experiment_id in ('__claude_write_probe__', '__claude_probe__');


-- ----------------------------------------------------------------------------
-- Check it worked.
-- ----------------------------------------------------------------------------
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'experiment_results'
   and column_name in ('experiment_name', 'trial_timestamp', 'word')
 order by column_name;

select count(*) as rows_remaining from public.experiment_results;
