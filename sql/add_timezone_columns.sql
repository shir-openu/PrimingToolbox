-- Where and when the participant actually sat down.
--
-- WHY
-- ---
-- The pilot data has no location information of any kind and no honest local
-- time either. `created_at` is a server DEFAULT now(), so every one of the 241
-- rows reads 23 December 2025 - the day they were inserted, not the day people
-- took part. The real session times were only recoverable because the
-- participant IDs happen to encode Date.now() in base 36, which is an accident,
-- not a design.
--
-- These three columns fix that, and give the DHSS proposal a location variable
-- it can actually use, without ever touching an IP address:
--
--   client_timezone   'Asia/Jerusalem'  - the IANA zone the browser reports.
--                     Country-level information, volunteered by the browser,
--                     no geolocation lookup, no IP stored, no permission prompt.
--   client_utc_offset -120 (minutes)    - the numeric offset, for arithmetic.
--                     Negative-west convention, exactly as JavaScript's
--                     getTimezoneOffset() returns it. Kept alongside the zone
--                     name because a zone name needs a database to interpret
--                     and an offset does not.
--   client_started_at timestamptz       - when the browser says the trial
--                     happened, as opposed to when the row reached the server.
--
-- All three are nullable. Old rows keep NULL and stay valid; nothing here
-- rewrites or invalidates the existing 241.
--
-- PRIVACY
-- -------
-- A timezone is coarse: 'Asia/Jerusalem' identifies a country, not a person or
-- a city. It is already sent by the browser in ordinary use. No IP address, no
-- user agent, no city, no coordinates - none of those are collected here and
-- none should be added without an ethics decision.
--
-- RUN
-- ---
-- Supabase dashboard -> SQL Editor -> paste -> Run.
-- Safe to run twice: every statement is IF NOT EXISTS.

alter table if exists public.experiment_results
  add column if not exists client_timezone   text,
  add column if not exists client_utc_offset integer,
  add column if not exists client_started_at timestamptz;

alter table if exists public.ec_results
  add column if not exists client_timezone   text,
  add column if not exists client_utc_offset integer,
  add column if not exists client_started_at timestamptz;

alter table if exists public.subliminal_results
  add column if not exists client_timezone   text,
  add column if not exists client_utc_offset integer,
  add column if not exists client_started_at timestamptz;

comment on column public.experiment_results.client_timezone is
  'IANA timezone reported by the participant''s browser, e.g. Asia/Jerusalem. Country-level only; no IP or coordinates are collected.';
comment on column public.experiment_results.client_utc_offset is
  'Minutes returned by JavaScript getTimezoneOffset() at trial time (negative east of UTC, so Israel winter = -120).';
comment on column public.experiment_results.client_started_at is
  'Trial time according to the participant''s own clock. created_at is the server insert time and is NOT the session time.';

-- Check afterwards:
--   select column_name, data_type
--     from information_schema.columns
--    where table_name = 'experiment_results'
--      and column_name like 'client_%';
