-- MF MPanel Evidence pairing brute-force protection (additive; existing data preserved).
create table if not exists public.mfp_evidence_pairing_attempt_limits (
  email_hash text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mfp_evidence_pairing_attempt_limits enable row level security;
revoke all on table public.mfp_evidence_pairing_attempt_limits from anon, authenticated, public;
grant all on table public.mfp_evidence_pairing_attempt_limits to service_role;

create or replace function public.mfp_record_evidence_pairing_failure(p_email_hash text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  insert into public.mfp_evidence_pairing_attempt_limits(email_hash, attempt_count, window_started_at, blocked_until, updated_at)
  values (p_email_hash, 1, now(), null, now())
  on conflict (email_hash) do update set
    attempt_count = case when public.mfp_evidence_pairing_attempt_limits.window_started_at < now() - interval '15 minutes' then 1 else public.mfp_evidence_pairing_attempt_limits.attempt_count + 1 end,
    window_started_at = case when public.mfp_evidence_pairing_attempt_limits.window_started_at < now() - interval '15 minutes' then now() else public.mfp_evidence_pairing_attempt_limits.window_started_at end,
    blocked_until = case when (case when public.mfp_evidence_pairing_attempt_limits.window_started_at < now() - interval '15 minutes' then 1 else public.mfp_evidence_pairing_attempt_limits.attempt_count + 1 end) >= 10 then now() + interval '15 minutes' else null end,
    updated_at = now()
  returning attempt_count into v_count;
  return v_count;
end;
$$;
revoke all on function public.mfp_record_evidence_pairing_failure(text) from public, anon, authenticated;
grant execute on function public.mfp_record_evidence_pairing_failure(text) to service_role;
