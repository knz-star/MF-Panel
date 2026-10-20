-- MF MPanel v2.3.1: exact-email admin bootstrap and strict low-score enforcement.
-- This migration is additive and does not delete existing data.

create or replace function public.mfp_ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  uid uuid := auth.uid();
  u auth.users%rowtype;
  p public.mfp_user_profiles%rowtype;
  bootstrap_admin boolean := false;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into u from auth.users where id=uid;
  if not found then raise exception 'Authenticated account not found'; end if;
  bootstrap_admin := lower(coalesce(u.email,'')) = 'knzbro602@gmail.com' and u.email_confirmed_at is not null;
  insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status,team_confirmed,allowed_modules)
  values(
    uid,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name',split_part(coalesce(u.email,'user'),'@',1)),
    case when bootstrap_admin then 'ADMIN' else 'USER' end,
    'ACTIVE',
    bootstrap_admin,
    case when bootstrap_admin then array['searching','checking','reports','evidence','admin']::text[] else array['evidence']::text[] end
  )
  on conflict(user_id) do update set
    email=excluded.email,
    role=case when bootstrap_admin then 'ADMIN' else public.mfp_user_profiles.role end,
    account_status=case when bootstrap_admin then 'ACTIVE' else public.mfp_user_profiles.account_status end,
    team_confirmed=case when bootstrap_admin then true else public.mfp_user_profiles.team_confirmed end,
    allowed_modules=case when bootstrap_admin then array['searching','checking','reports','evidence','admin']::text[] else public.mfp_user_profiles.allowed_modules end,
    updated_at=now();
  select * into p from public.mfp_user_profiles where user_id=uid;
  return jsonb_build_object('user_id',p.user_id,'email',p.email,'display_name',p.display_name,'role',p.role,'account_status',p.account_status,'team_key',p.team_key,'team_confirmed',p.team_confirmed,'allowed_modules',p.allowed_modules);
end;
$function$;

update public.mfp_user_profiles
set role='ADMIN', account_status='ACTIVE', team_confirmed=true,
    allowed_modules=array['searching','checking','reports','evidence','admin']::text[], updated_at=now()
where lower(email)='knzbro602@gmail.com';
