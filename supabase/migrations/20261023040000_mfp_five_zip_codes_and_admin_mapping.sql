-- Exactly five admin-managed ZIP password slots. Passwords stay in the private schema;
-- only active senior Admins can read/write them through authenticated RPCs.
create schema if not exists mfp_private;
revoke all on schema mfp_private from public, anon;
grant usage on schema mfp_private to authenticated;
create table if not exists mfp_private.mfp_export_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table mfp_private.mfp_export_settings enable row level security;
revoke all on mfp_private.mfp_export_settings from public, anon, authenticated;

create or replace function public.mfp_get_evidence_zip_passwords()
returns jsonb language plpgsql security definer set search_path=public,mfp_private,auth,pg_temp as $$
declare v_uid uuid := auth.uid(); v_codes jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.mfp_user_profiles where user_id=v_uid and role='ADMIN' and account_status='ACTIVE') then
    raise exception 'Active senior administrator access required';
  end if;
  select setting_value->'zip_passwords' into v_codes from mfp_private.mfp_export_settings where setting_key='website_zip_export';
  if coalesce(jsonb_typeof(v_codes),'') <> 'array' or jsonb_array_length(coalesce(v_codes,'[]'::jsonb)) <> 5 then return '[]'::jsonb; end if;
  return v_codes;
end; $$;

create or replace function public.mfp_admin_generate_evidence_zip_passwords()
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid := auth.uid(); v_codes jsonb := '[]'::jsonb; i integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.mfp_user_profiles where user_id=v_uid and role='ADMIN' and account_status='ACTIVE') then
    raise exception 'Active senior administrator access required';
  end if;
  for i in 1..5 loop
    v_codes := v_codes || jsonb_build_array(jsonb_build_object('label','Code '||i,'password',encode(gen_random_bytes(12),'hex')));
  end loop;
  return v_codes;
end; $$;

create or replace function public.mfp_admin_set_evidence_zip_passwords(p_codes jsonb)
returns jsonb language plpgsql security definer set search_path=public,mfp_private,auth,pg_temp as $$
declare v_uid uuid := auth.uid(); v_passwords text[]; v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.mfp_user_profiles where user_id=v_uid and role='ADMIN' and account_status='ACTIVE') then
    raise exception 'Active senior administrator access required';
  end if;
  if coalesce(jsonb_typeof(p_codes),'') <> 'array' or jsonb_array_length(coalesce(p_codes,'[]'::jsonb)) <> 5 then raise exception 'Exactly five ZIP code slots are required'; end if;
  select array_agg(trim(x->>'password') order by ord) into v_passwords from jsonb_array_elements(p_codes) with ordinality as t(x,ord);
  if array_length(v_passwords,1) <> 5 or exists(select 1 from unnest(v_passwords) p where length(p)<8 or length(p)>128) then
    raise exception 'All five ZIP codes must be 8–128 characters';
  end if;
  select count(distinct p) into v_count from unnest(v_passwords) p;
  if v_count <> 5 then raise exception 'Each of the five ZIP codes must be unique'; end if;
  if exists(select 1 from jsonb_array_elements(p_codes) x where length(trim(coalesce(x->>'label',''))) < 1 or length(trim(x->>'label')) > 40) then
    raise exception 'Each ZIP code needs a label of 1–40 characters';
  end if;
  insert into mfp_private.mfp_export_settings(setting_key,setting_value,updated_by,updated_at)
  values('website_zip_export',jsonb_build_object('zip_passwords',p_codes,'zip_password',v_passwords[1]),v_uid,now())
  on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=v_uid,updated_at=now();
  return jsonb_build_object('success',true,'configured',5,'updated_at',now());
end; $$;

revoke all on function public.mfp_get_evidence_zip_passwords() from public,anon;
revoke all on function public.mfp_admin_generate_evidence_zip_passwords() from public,anon;
revoke all on function public.mfp_admin_set_evidence_zip_passwords(jsonb) from public,anon;
grant execute on function public.mfp_get_evidence_zip_passwords() to authenticated;
grant execute on function public.mfp_admin_generate_evidence_zip_passwords() to authenticated;
grant execute on function public.mfp_admin_set_evidence_zip_passwords(jsonb) to authenticated;
notify pgrst,'reload schema';
