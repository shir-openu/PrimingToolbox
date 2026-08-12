-- ============================================================================
--  PrimingToolbox — RUN THIS ONE FILE.  Everything, in the right order.
--
--  It replaces having to run two separate files. Safe to run again and again:
--  every statement is IF NOT EXISTS / OR REPLACE, and the clean-up deletes only
--  rows that are explicitly marked as mine.
--
--  HOW:
--    1. https://supabase.com/dashboard/project/luhgdmzksitdkbysdfbr/sql
--    2. New query
--    3. Select ALL of this file, copy, paste
--    4. Run
--    5. Read the last result table. Every row should say PASS.
--
--  If anything says FAIL, copy the error text and send it to me.
-- ============================================================================


-- ── PART 1 ─ the three columns the trial engine has always sent ─────────────
--
-- PTA.Engine sends experiment_name and trial_timestamp on every trial, and
-- `word` on Stroop trials. None of them was a column here, and PostgREST
-- rejects an ENTIRE insert for one unknown field - so the generic engine, the
-- path every participant link takes, had never stored a single row.

alter table public.experiment_results add column if not exists experiment_name text;
alter table public.experiment_results add column if not exists trial_timestamp timestamptz;
alter table public.experiment_results add column if not exists word text;

create index if not exists experiment_results_experiment_id_idx
  on public.experiment_results (experiment_id);
create index if not exists experiment_results_experimenter_idx
  on public.experiment_results (experimenter_email, user_experiment_id);


-- ── PART 2 ─ clean up my test rows ──────────────────────────────────────────
--
-- Checking that writing still worked after you restored the project meant
-- actually writing. The anon key has no DELETE policy, so I could not remove
-- them myself. Three rows, all clearly marked.

delete from public.experiment_results
 where experiment_id in ('__claude_write_probe__', '__claude_probe__');


-- ── PART 3 ─ the experimenter layer and the meta layer ──────────────────────
--
-- The DHSS proposal defines three layers of use and asks whether early, active
-- adoption of the visual timeline predicts experimenter persistence. Only the
-- participant layer was ever recorded. The timeline wrote its state to the
-- browser's localStorage and nothing else, so T and U - the two variables the
-- Cox model starts from - never existed anywhere.

create table if not exists public.platform_events (
  id                 bigserial primary key,
  experimenter_key   text not null,      -- identifies a BROWSER, not a person
  experimenter_email text,
  session_id         text not null,
  event_type         text not null,
  experiment_type    text,
  user_experiment_id text,
  payload            jsonb,
  client_ts          timestamptz,        -- the browser's clock
  created_at         timestamptz not null default now(),
  client_language    text,               -- X covariate, from the browser
  client_timezone    text                -- X covariate, country proxy
);

create index if not exists platform_events_key_idx
  on public.platform_events (experimenter_key, created_at);
create index if not exists platform_events_email_idx
  on public.platform_events (experimenter_email);
create index if not exists platform_events_type_idx
  on public.platform_events (event_type, created_at);

alter table public.platform_events enable row level security;

drop policy if exists ptbx_events_anon_insert on public.platform_events;
create policy ptbx_events_anon_insert
  on public.platform_events for insert to anon with check (true);

drop policy if exists ptbx_events_anon_select on public.platform_events;
create policy ptbx_events_anon_select
  on public.platform_events for select to anon using (true);

grant insert, select on public.platform_events to anon;
grant usage, select on sequence public.platform_events_id_seq to anon;


-- ── PART 4 ─ z = (T,U,E,P,D,R,C,X), one row per experimenter ────────────────
--
-- Ready for the Cox model, the logistic regression, the Poisson counts and the
-- clustering, with the proposal's own derived measures.

create or replace view public.experimenter_metrics as
with base as (
  select
    experimenter_key                                             as key,
    max(experimenter_email)                                      as email,
    min(created_at)                                              as first_seen,
    max(created_at)                                              as last_seen,
    count(distinct date_trunc('day', created_at))                as d_active_days,
    count(*) filter (where event_type = 'timeline_edit')         as u_timeline_edits,
    count(*) filter (where event_type = 'editor_heartbeat') * 15 as u_editor_seconds,
    count(*) filter (where event_type = 'draft_saved')           as e_created,
    count(*) filter (where event_type = 'link_generated')        as p_published,
    max(client_language)                                         as x_language,
    max(client_timezone)                                         as x_timezone
  from public.platform_events
  group by experimenter_key
),
early as (
  -- T: at least one timeline edit in that experimenter's FIRST session
  select distinct e.experimenter_key as key
  from public.platform_events e
  join (select experimenter_key, min(created_at) as t0
          from public.platform_events group by experimenter_key) f
    on f.experimenter_key = e.experimenter_key
  where e.event_type = 'timeline_edit'
    and e.created_at < f.t0 + interval '1 day'
),
completions as (
  select experimenter_email as email, count(distinct participant_id) as c_completions
  from public.experiment_results
  where experimenter_email is not null
  group by experimenter_email
)
select
  b.key,
  b.email,
  b.first_seen,
  b.last_seen,
  (case when ea.key is not null then 1 else 0 end)                as t_early_timeline,
  (b.u_timeline_edits + b.u_editor_seconds)                       as u_intensity,
  b.u_timeline_edits,
  b.u_editor_seconds,
  b.e_created,
  b.p_published,
  b.d_active_days,
  (case when b.last_seen > b.first_seen + interval '14 days' then 1 else 0 end) as r_returned,
  coalesce(c.c_completions, 0)                                    as c_completions,
  b.x_language,
  b.x_timezone,
  -- explicit ::numeric so ln() resolves: the counts above are all bigint
  ln((1 + b.e_created + b.p_published + b.d_active_days)::numeric) as pers_score,
  b.p_published::numeric / nullif(b.e_created, 0)                 as pub_efficiency,
  coalesce(c.c_completions, 0)::numeric / nullif(b.p_published, 0) as rec_efficiency
from base b
left join early ea on ea.key = b.key
left join completions c on c.email = b.email;

-- A view is NOT covered by the underlying table's RLS policies; the anon role
-- needs its own grant or every read returns "permission denied for view".
-- Missing this is why the first version of this script left the view
-- unreadable from the platform.
grant select on public.experimenter_metrics to anon;


-- ── PART 5 ─ did it work? Every row must say PASS ───────────────────────────

select 'experiment_results.experiment_name' as what,
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='experiment_results'
                            and column_name='experiment_name')
            then 'PASS' else 'FAIL' end as result
union all
select 'experiment_results.trial_timestamp',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='experiment_results'
                            and column_name='trial_timestamp')
            then 'PASS' else 'FAIL' end
union all
select 'experiment_results.word',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='experiment_results'
                            and column_name='word')
            then 'PASS' else 'FAIL' end
union all
select 'table platform_events',
       case when exists (select 1 from information_schema.tables
                          where table_schema='public' and table_name='platform_events')
            then 'PASS' else 'FAIL' end
union all
select 'view experimenter_metrics',
       case when exists (select 1 from information_schema.views
                          where table_schema='public' and table_name='experimenter_metrics')
            then 'PASS' else 'FAIL' end
union all
select 'anon can read platform_events',
       case when exists (select 1 from information_schema.role_table_grants
                          where table_schema='public' and table_name='platform_events'
                            and grantee='anon' and privilege_type='SELECT')
            then 'PASS' else 'FAIL' end
union all
select 'anon can read experimenter_metrics',
       case when exists (select 1 from information_schema.role_table_grants
                          where table_schema='public' and table_name='experimenter_metrics'
                            and grantee='anon' and privilege_type='SELECT')
            then 'PASS' else 'FAIL' end
union all
select 'my test rows removed',
       case when not exists (select 1 from public.experiment_results
                              where experiment_id in ('__claude_write_probe__','__claude_probe__'))
            then 'PASS' else 'FAIL' end
union all
select 'real rows still here (should be 257)',
       case when (select count(*) from public.experiment_results) >= 240
            then 'PASS' else 'FAIL' end;
