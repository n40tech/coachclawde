-- ---------------------------------------------------------------------------
-- 0007_rest_alarms — rest-timer alerts (v1.0.6).
--
-- When the app goes into the background mid-rest it arms an alarm through the
-- `rest-alarm` Edge Function, which stores it here; coming back to the app
-- cancels it. While any alarm exists, a once-a-second pg_cron job
-- ("rest-alarm-tick") asks the function to send the due ones as Web Push
-- notifications. The job creates itself when an alarm is armed and removes
-- itself (and its run history) once the table is empty, so nothing runs
-- between workouts.
--
-- Rows hold push subscriptions, so only the service role (the Edge Function)
-- may touch the table: RLS is on and there are no client policies.
--
-- Needs two Vault secrets (docs/DEPLOYMENT.md → "Rest-timer alerts"):
--   rest_alarm_function_url  https://<project-ref>.supabase.co/functions/v1/rest-alarm
--   rest_alarm_tick_secret   the same random string as the function's REST_ALARM_TICK_SECRET
-- Without them the ticker sends nothing and drops alarms two minutes late.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.rest_alarms (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  alarm_id     text        not null,
  fire_at      timestamptz not null,
  subscription jsonb       not null,
  payload      jsonb       not null,
  created_at   timestamptz not null default now()
);

create index if not exists rest_alarms_fire_at_idx on public.rest_alarms (fire_at);

alter table public.rest_alarms enable row level security;
revoke all on public.rest_alarms from anon, authenticated;

-- Runs every second while alarms exist (scheduled by the trigger below).
create or replace function public.rest_alarm_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
  job    bigint;
begin
  -- Serialise with arming: an alarm armed meanwhile is either seen here, or
  -- its trigger runs after this commits and schedules the job again.
  lock table public.rest_alarms in share row exclusive mode;

  -- Two minutes late means undeliverable (function down, secrets missing):
  -- drop it rather than retry forever.
  delete from public.rest_alarms where fire_at < now() - interval '2 minutes';

  if not exists (select 1 from public.rest_alarms) then
    select jobid into job from cron.job where jobname = 'rest-alarm-tick';
    if job is not null then
      perform cron.unschedule(job);
      delete from cron.job_run_details where jobid = job;
    end if;
    return;
  end if;

  -- The same one-second lead as LEAD_MS in supabase/functions/rest-alarm.
  if exists (select 1 from public.rest_alarms where fire_at <= now() + interval '1 second') then
    select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'rest_alarm_function_url';
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'rest_alarm_tick_secret';
    if fn_url is not null and secret is not null then
      perform net.http_post(
        url := fn_url,
        body := jsonb_build_object('action', 'tick'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-rest-alarm-secret', secret),
        timeout_milliseconds := 10000
      );
    end if;
  end if;
end;
$$;

create or replace function public.rest_alarms_start_ticker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from cron.job where jobname = 'rest-alarm-tick') then
    perform cron.schedule('rest-alarm-tick', '1 seconds', 'select public.rest_alarm_tick()');
  end if;
  return null;
end;
$$;

drop trigger if exists rest_alarms_start_ticker on public.rest_alarms;
create trigger rest_alarms_start_ticker
  after insert or update on public.rest_alarms
  for each statement execute function public.rest_alarms_start_ticker();

-- Not callable through the API.
revoke all on function public.rest_alarm_tick() from public, anon, authenticated;
revoke all on function public.rest_alarms_start_ticker() from public, anon, authenticated;

notify pgrst, 'reload schema';
