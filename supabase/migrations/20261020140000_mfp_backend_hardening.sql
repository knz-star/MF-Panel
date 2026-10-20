-- MF MPanel v2.14.2 — backend hardening. Idempotent; safe to run after 20261020133000.
-- Apply to an isolated QA branch first.

-- 1) mfp_web_api (team analytics -> reviewLowScore) inserts into public.mfp_web_notifications,
--    but no migration in this repo ever created it (it only exists on the live project).
--    Create it when missing so a fresh/staging database works too. No-op on live.
create table if not exists public.mfp_web_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default '',
  message text not null default '',
  notification_type text not null default 'INFO',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.mfp_web_notifications add column if not exists user_id uuid;
alter table public.mfp_web_notifications add column if not exists title text;
alter table public.mfp_web_notifications add column if not exists message text;
alter table public.mfp_web_notifications add column if not exists notification_type text;
alter table public.mfp_web_notifications add column if not exists created_at timestamptz default now();
alter table public.mfp_web_notifications enable row level security;
drop policy if exists mfp_web_notifications_own_read on public.mfp_web_notifications;
create policy mfp_web_notifications_own_read on public.mfp_web_notifications
  for select to authenticated using (user_id = auth.uid());
revoke all on public.mfp_web_notifications from anon;
grant select on public.mfp_web_notifications to authenticated;
create index if not exists mfp_web_notifications_user_idx on public.mfp_web_notifications(user_id, created_at desc);

-- 2) Expired pairing codes were never cleaned up. Keep rows for audit if they were used/linked;
--    only remove PENDING/CANCELLED codes a week after expiry.
create index if not exists mfp_pairing_pending_expiry_idx
  on public.mfp_evidence_pairing_requests(expires_at) where status = 'PENDING';

create or replace function mfp_private.cleanup_expired_pairings()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  delete from public.mfp_evidence_pairing_requests
   where status in ('PENDING','CANCELLED') and expires_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function mfp_private.cleanup_expired_pairings() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'mfp-cleanup-expired-pairings';
    perform cron.schedule('mfp-cleanup-expired-pairings', '17 3 * * *', 'select mfp_private.cleanup_expired_pairings()');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;

-- 3) Document that these RLS-enabled tables are deliberately RPC-only (no direct client policy),
--    which the Supabase linter reports as "RLS enabled, no policy".
do $$
declare t text;
begin
  foreach t in array array['mfp_evidence_activity_events','mfp_evidence_pairing_attempt_limits','mfp_evidence_score_snapshots','mfp_evidence_work_items','mfp_team_admin_assignments','mfp_team_score_warnings','mfp_team_trend_alerts'] loop
    if to_regclass('public.' || t) is not null then
      execute format('comment on table public.%I is %L', t, 'RPC-only: accessed through mfp_web_api (security definer). No direct client policy by design.');
    end if;
  end loop;
end $$;
