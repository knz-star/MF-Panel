-- The old single-password RPC is retained for compatibility but is now senior-Admin-only.
-- It must not expose the first slot of the new five-code configuration to Team Admins.
create or replace function public.mfp_get_evidence_zip_password()
returns text
language plpgsql
security definer
set search_path = public, mfp_private, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_password text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.mfp_user_profiles
    where user_id=v_uid and role='ADMIN' and account_status='ACTIVE'
  ) then raise exception 'Active senior administrator access required'; end if;
  select nullif(setting_value->>'zip_password','') into v_password
  from mfp_private.mfp_export_settings where setting_key='website_zip_export' limit 1;
  if v_password is null then
    select nullif(value->>'zip_password','') into v_password from public.config where key='export_settings' limit 1;
  end if;
  if v_password is null then raise exception 'No legacy ZIP password is configured'; end if;
  return v_password;
end; $$;
revoke all on function public.mfp_get_evidence_zip_password() from public,anon;
grant execute on function public.mfp_get_evidence_zip_password() to authenticated;
notify pgrst,'reload schema';
