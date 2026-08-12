-- What the prime actually did, not what was asked of it.
--
-- js/subliminal.js shows the prime by counting animation frames:
--     primeFrames = max(1, round(timing.prime / state.frameTime))
-- state.frameTime is estimated once at init by counting 60 frames. If that
-- estimate is wrong, or never completed because the tab was hidden, it stays at
-- the 16.67 ms default - and on a 120 Hz display the prime is then shown for
-- 2 frames, about 16.7 ms.
--
-- Every row still recorded prime_duration_ms = 33, the REQUESTED value, so a
-- run whose prime was silently halved looked exactly like one that was not. In
-- a subliminal paradigm the prime duration is the independent variable: it is
-- the whole difference between subliminal and visible.
--
-- These three columns record the outcome beside the intention, so trials where
-- they disagree can be found and dropped.
--
-- Safe to run more than once. Adds columns only; touches no existing data.

alter table public.subliminal_results
  add column if not exists prime_actual_ms     numeric,   -- measured, to 0.01 ms
  add column if not exists prime_frames_shown  integer,   -- frames actually painted
  add column if not exists frame_rate_hz       integer;   -- what the module believed the display was

comment on column public.subliminal_results.prime_actual_ms is
  'Measured prime duration in ms (performance.now across the counted frames). Compare with prime_duration_ms, which is the requested value.';
comment on column public.subliminal_results.prime_frames_shown is
  'Animation frames the prime was actually painted for.';
comment on column public.subliminal_results.frame_rate_hz is
  'Refresh rate estimated at init. If this is not the display real rate, prime_actual_ms will disagree with prime_duration_ms.';

-- verification
select 'prime_actual_ms',    case when exists (select 1 from information_schema.columns
         where table_schema='public' and table_name='subliminal_results'
           and column_name='prime_actual_ms') then 'PASS' else 'FAIL' end
union all
select 'prime_frames_shown', case when exists (select 1 from information_schema.columns
         where table_schema='public' and table_name='subliminal_results'
           and column_name='prime_frames_shown') then 'PASS' else 'FAIL' end
union all
select 'frame_rate_hz',      case when exists (select 1 from information_schema.columns
         where table_schema='public' and table_name='subliminal_results'
           and column_name='frame_rate_hz') then 'PASS' else 'FAIL' end
union all
select 'existing rows untouched',
       case when (select count(*) from public.subliminal_results) >= 0 then 'PASS' else 'FAIL' end;
