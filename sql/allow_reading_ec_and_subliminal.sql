-- APPLIED 2026-08-14, on Shir's instruction. It was held back until then
-- because it changes who can READ data rather than adding a column; everything
-- else found on 2026-08-12 was applied directly.
--
-- VERIFIED, not assumed. A policy row existing is not a read working, and with
-- both tables empty the anon response is 200/[] whether or not it is readable -
-- the exact ambiguity described below. So one marked probe row was committed to
-- each table, read back through the public anon key over HTTPS (1 row seen in
-- both), then deleted with the postgres connection; both tables are empty again.
--
-- THE PROBLEM
--
-- Three tables hold results:
--
--   experiment_results   RLS on, anon INSERT + anon SELECT   241 rows
--   ec_results           RLS on, anon INSERT only              0 rows
--   subliminal_results   RLS on, anon INSERT only              0 rows
--
-- Evaluative conditioning writes to ec_results and the subliminal paradigm
-- writes to subliminal_results, and both inserts work. But nothing can read
-- them back: with RLS on and no SELECT policy, a select through the anon key
-- returns zero rows - not an error, just nothing. db-viewer.html queries only
-- experiment_results, and PTA.fetchExperimenterData is given a table name by
-- its caller.
--
-- So a researcher can run an evaluative-conditioning study, have every trial
-- stored correctly, and find no way to see or export it from inside the
-- platform. Both tables are empty today, so nothing has been lost - this is a
-- gap to close before the first real run, not a rescue.
--
-- WHAT THIS COSTS
--
-- anon SELECT means anyone holding the public anon key - which ships in
-- js/core_fab.js and is public by design - can read every row in those tables.
-- That is ALREADY true of experiment_results and its 241 pilot rows, so this
-- makes the three tables consistent rather than opening a new kind of hole.
-- It is still worth deciding on purpose rather than by accident.
--
-- THE ALTERNATIVE, if that is not wanted: have the two paradigms write to
-- experiment_results like every other paradigm, and retire these tables. That
-- keeps one place to read from, but experiment_results has no rating, cs_label,
-- us_valence or phase column, so those would have to be added or folded into
-- existing ones. More work, no wider exposure.
--
-- Safe to run more than once.

drop policy if exists ptbx_anon_select_ec on public.ec_results;
create policy ptbx_anon_select_ec
  on public.ec_results for select
  to anon
  using (true);

drop policy if exists ptbx_anon_select_subliminal on public.subliminal_results;
create policy ptbx_anon_select_subliminal
  on public.subliminal_results for select
  to anon
  using (true);

-- verification
select 'ec_results readable by anon',
       case when exists (select 1 from pg_policies
                          where schemaname='public' and tablename='ec_results'
                            and cmd='SELECT' and roles::text like '%anon%')
            then 'PASS' else 'FAIL' end
union all
select 'subliminal_results readable by anon',
       case when exists (select 1 from pg_policies
                          where schemaname='public' and tablename='subliminal_results'
                            and cmd='SELECT' and roles::text like '%anon%')
            then 'PASS' else 'FAIL' end
union all
select 'inserts still allowed on ec_results',
       case when exists (select 1 from pg_policies
                          where schemaname='public' and tablename='ec_results'
                            and cmd='INSERT')
            then 'PASS' else 'FAIL' end
union all
select 'inserts still allowed on subliminal_results',
       case when exists (select 1 from pg_policies
                          where schemaname='public' and tablename='subliminal_results'
                            and cmd='INSERT')
            then 'PASS' else 'FAIL' end;
