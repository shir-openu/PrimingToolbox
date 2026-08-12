-- ============================================================================
-- platform_events — the experimenter layer and the meta layer.
--
-- WHY THIS TABLE EXISTS
--
-- The DHSS proposal (DHSS-proposal-PrimingToolBox-Shir-Sivroni.pdf) describes
-- three layers of use, and states the research question as:
--
--     "Is early, active adoption of a visual timeline representation
--      associated with experimenter persistence over time?"
--
-- Read against the platform as it stood on 2026-08-12, only ONE of the three
-- layers was recorded anywhere. experiment_results holds the participant layer.
-- The experimenter layer and the meta layer were not logged at all: the trial
-- timeline wrote its state to localStorage and nothing else, so a timeline edit
-- never left the browser.
--
-- Against the proposal's own variable list, z_i = (T,U,E,P,D,R,C,X):
--
--     T  early timeline adoption ............ NOT RECORDED
--     U  timeline-use intensity ............. NOT RECORDED
--     E  experiments created (incl. drafts) . NOT RECORDED
--     P  experiments published (links) ...... NOT RECORDED
--     D  active days ........................ NOT RECORDED
--     R  return after >= 14 days ............ NOT RECORDED
--     C  participant completions ............ partly derivable from
--                                             experiment_results
--     X  covariates ......................... NOT COLLECTED
--
-- So the Cox model, the logistic regression, the Poisson counts and the
-- behavioural clustering could not have been run: seven of the eight variables
-- did not exist. A backup of experiment_results, however faithful, cannot
-- rescue data the platform never wrote. This table is what makes the proposed
-- analyses possible.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   https://supabase.com/dashboard/project/luhgdmzksitdkbysdfbr/sql
--
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.platform_events (
  id                 bigserial primary key,

  -- WHO. experimenter_key is a random id kept in the browser's localStorage, so
  -- activity before someone types an email still belongs to one person and can
  -- be joined to the email the moment it appears. It identifies a browser, not
  -- a human, and carries nothing personal.
  experimenter_key   text not null,
  experimenter_email text,
  session_id         text not null,

  -- WHAT
  event_type         text not null,
  experiment_type    text,
  user_experiment_id text,
  payload            jsonb,

  -- WHEN. client_ts is the browser's clock, created_at is the server's. Keep
  -- both: the server time is trustworthy, the client time is what tells you the
  -- participant's local hour, and a large gap between them is itself a signal.
  client_ts          timestamptz,
  created_at         timestamptz not null default now(),

  -- X_i covariates, taken from the browser rather than asked for. Neither is
  -- personally identifying, and together they cover the proposal's "language"
  -- and "country proxy". Course context, prior experience and level of study
  -- still have to be asked; there is a placeholder in payload for them.
  client_language    text,
  client_timezone    text
);

comment on table public.platform_events is
  'Experimenter-layer and meta-layer event log. Supplies T, U, E, P, D, R and X '
  'from the DHSS proposal variable list; C comes from experiment_results.';

-- The event vocabulary, and which proposal variable each one feeds:
--   session_start           D (active days), R (returns)
--   builder_opened          engagement
--   timeline_opened         T (adoption, together with timeline_edit)
--   timeline_edit           T (>=1 edit in the first session), U (edit count)
--   editor_heartbeat        U (time in editor; one every 15s while open)
--   draft_saved             E (experiments created, drafts included)
--   link_generated          P (experiments published)
--   preview_run             engagement
--   participant_completed   C (cross-check against experiment_results)

create index if not exists platform_events_key_idx
  on public.platform_events (experimenter_key, created_at);
create index if not exists platform_events_email_idx
  on public.platform_events (experimenter_email);
create index if not exists platform_events_type_idx
  on public.platform_events (event_type, created_at);
create index if not exists platform_events_session_idx
  on public.platform_events (session_id);


-- ---------------------------------------------------------------------------
-- Row-level security, matching the policy shape experiment_results already uses:
-- the anonymous key may write events and read them back, nothing more.
-- ---------------------------------------------------------------------------
alter table public.platform_events enable row level security;

drop policy if exists ptbx_events_anon_insert on public.platform_events;
create policy ptbx_events_anon_insert
  on public.platform_events for insert to anon
  with check (true);

drop policy if exists ptbx_events_anon_select on public.platform_events;
create policy ptbx_events_anon_select
  on public.platform_events for select to anon
  using (true);


-- ---------------------------------------------------------------------------
-- The proposal's z_i, as a view. One row per experimenter, ready for the Cox
-- model, the logistic regression, the Poisson counts and the clustering.
--
--   Pers   = log(1 + E + P + D)
--   PubEff = P / (E + eps)
--   RecEff = C / (P + eps)
-- ---------------------------------------------------------------------------
create or replace view public.experimenter_metrics as
with base as (
  select
    experimenter_key                                                as key,
    max(experimenter_email)                                         as email,
    min(created_at)                                                 as first_seen,
    max(created_at)                                                 as last_seen,
    count(distinct date_trunc('day', created_at))                   as d_active_days,
    count(*) filter (where event_type = 'timeline_edit')            as u_timeline_edits,
    count(*) filter (where event_type = 'editor_heartbeat') * 15    as u_editor_seconds,
    count(*) filter (where event_type = 'draft_saved')              as e_created,
    count(*) filter (where event_type = 'link_generated')           as p_published,
    max(client_language)                                            as x_language,
    max(client_timezone)                                            as x_timezone
  from public.platform_events
  group by experimenter_key
),
early as (
  -- T: at least one timeline edit during the FIRST session of that experimenter
  select distinct e.experimenter_key as key
  from public.platform_events e
  join (
    select experimenter_key, min(created_at) as t0
    from public.platform_events group by experimenter_key
  ) f on f.experimenter_key = e.experimenter_key
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
  (case when ea.key is not null then 1 else 0 end)                   as t_early_timeline,
  (b.u_timeline_edits + b.u_editor_seconds)                          as u_intensity,
  b.u_timeline_edits,
  b.u_editor_seconds,
  b.e_created,
  b.p_published,
  b.d_active_days,
  (case when b.last_seen > b.first_seen + interval '14 days' then 1 else 0 end) as r_returned,
  coalesce(c.c_completions, 0)                                       as c_completions,
  b.x_language,
  b.x_timezone,
  ln(1 + b.e_created + b.p_published + b.d_active_days)              as pers_score,
  b.p_published::numeric / nullif(b.e_created, 0)                    as pub_efficiency,
  coalesce(c.c_completions, 0)::numeric / nullif(b.p_published, 0)   as rec_efficiency
from base b
left join early ea on ea.key = b.key
left join completions c on c.email = b.email;


-- ---------------------------------------------------------------------------
-- Check it worked.
-- ---------------------------------------------------------------------------
select count(*) as events from public.platform_events;
select * from public.experimenter_metrics;
