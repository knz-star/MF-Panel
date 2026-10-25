create table if not exists public.mfp_password_reset_requests (
  id bigint generated always as identity primary key,
  email_normalized text not null,
  requested_at timestamptz not null default now()
);
create index if not exists mfp_password_reset_requests_email_time_idx
  on public.mfp_password_reset_requests (email_normalized, requested_at desc);
alter table public.mfp_password_reset_requests enable row level security;
revoke all on public.mfp_password_reset_requests from anon, authenticated, public;

create or replace function public.mfp_check_password_reset_quota(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_count integer;
  v_oldest timestamptz;
  v_now timestamptz := now();
begin
  if length(v_email) < 3 or length(v_email) > 320 or position('@' in v_email) < 2 then
    return jsonb_build_object('allowed', false, 'message', 'Enter a valid email address.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  select count(*)::integer, min(requested_at)
    into v_count, v_oldest
    from public.mfp_password_reset_requests
    where email_normalized = v_email
      and requested_at > v_now - interval '7 days';
  if v_count >= 2 then
    return jsonb_build_object(
      'allowed', false,
      'retryAt', to_jsonb(v_oldest + interval '7 days'),
      'message', 'Password reset limit reached. You can request another reset after the 7-day window.'
    );
  end if;
  insert into public.mfp_password_reset_requests(email_normalized, requested_at)
    values (v_email, v_now);
  return jsonb_build_object('allowed', true, 'remaining', 1 - v_count);
end;
$$;
revoke all on function public.mfp_check_password_reset_quota(text) from public;
grant execute on function public.mfp_check_password_reset_quota(text) to anon, authenticated;
