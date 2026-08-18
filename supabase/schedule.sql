-- ============================================================================
-- Daily schedule for the monthly-session-reset Edge Function.
--
-- Supabase does NOT schedule Edge Functions from config.toml. Deploying the
-- function only makes it callable; something has to invoke it. This registers a
-- pg_cron job that POSTs to the function once a day, which is what drives Tasks
-- A–D (annual reset, autopay safety net, expiry zeroing, expiry emails).
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL). Re-running is safe:
-- it unschedules any existing job of the same name first.
--
-- Before running, replace the two placeholders:
--   <PROJECT_REF>       your project ref, e.g. abcd1234  (Dashboard → Project Settings → General)
--   <SERVICE_ROLE_KEY>  Project Settings → API → service_role secret
--
-- The Authorization header is REQUIRED: the function runs with verify_jwt = true,
-- so an unauthenticated call would 401 and silently do nothing (which is exactly
-- how the safety net was missing before — deployed but never invoked).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove a prior version of this job (no-op if it doesn't exist) so this file is
-- safe to re-run when the URL or key rotates.
select cron.unschedule('monthly-session-reset-daily')
where exists (select 1 from cron.job where jobname = 'monthly-session-reset-daily');

select cron.schedule(
  'monthly-session-reset-daily',
  '5 0 * * *',                      -- 00:05 UTC every day
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/monthly-session-reset',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Verify:
--   select jobname, schedule, active from cron.job where jobname = 'monthly-session-reset-daily';
-- Inspect recent runs:
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'monthly-session-reset-daily')
--     order by start_time desc limit 10;
