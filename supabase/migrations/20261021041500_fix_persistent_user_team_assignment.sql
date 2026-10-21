-- MF MPanel: persistent user access assignment
-- The live project also has this RPC applied.
create or replace function public.mfp_admin_update_user_access(
  p_target_uid uuid, p_role text, p_account_status text, p_team text default null
) returns jsonb language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare actor uuid := auth.uid(); target public.mfp_user_profiles%rowtype;
  v_role text := upper(coalesce(p_role,'')); v_status text := upper(coalesce(p_account_status,''));
  v_team text := nullif(lower(trim(coalesce(p_team,''))), ''); v_modules text[]; v_confirmed boolean; v_doc jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.mfp_user_profiles a where a.user_id=actor and a.role='ADMIN' and a.account_status='ACTIVE') then raise exception 'Administrator access required'; end if;
  if v_role not in ('USER','TEAM_ADMIN','ADMIN') then raise exception 'Invalid role'; end if;
  if v_status not in ('PENDING','ACTIVE','DISABLED') then raise exception 'Invalid account status'; end if;
  if v_role='ADMIN' then v_team:=null; v_modules:=array['searching','checking','reports','evidence','admin']::text[]; v_confirmed:=true;
  else
    if v_team is not null and v_team not in ('searching','checking','reports','evidence') then raise exception 'Invalid team'; end if;
    if v_status='ACTIVE' and v_team is null then raise exception 'An active non-admin user must have exactly one team'; end if;
    v_modules:=case when v_status='ACTIVE' and v_team is not null then array[v_team]::text[] else '{}'::text[] end; v_confirmed:=v_status='ACTIVE' and v_team is not null;
  end if;
  select * into target from public.mfp_user_profiles where user_id=p_target_uid for update;
  if not found then raise exception 'User profile not found'; end if;
  update public.mfp_user_profiles set role=v_role,account_status=v_status,team_key=v_team,team_confirmed=v_confirmed,allowed_modules=v_modules,updated_at=now() where user_id=p_target_uid returning * into target;
  v_doc:=jsonb_build_object('uid',target.user_id,'userId',target.user_id,'email',target.email,'displayName',target.display_name,'role',target.role,'accountStatus',target.account_status,'team',target.team_key,'teamKey',target.team_key,'teamConfirmed',target.team_confirmed,'allowedModules',to_jsonb(target.allowed_modules),'updatedAt',target.updated_at);
  update public.mfp_documents set data=coalesce(data,'{}'::jsonb)||v_doc,team_key=target.team_key,updated_at=now() where collection_name='users' and document_id=target.user_id::text;
  if not found then insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key) values('users',target.user_id::text,v_doc,target.user_id,target.team_key) on conflict(collection_name,document_id) do update set data=coalesce(public.mfp_documents.data,'{}'::jsonb)||excluded.data,team_key=excluded.team_key,updated_at=now(); end if;
  return jsonb_build_object('success',true,'userId',target.user_id,'role',target.role,'accountStatus',target.account_status,'team',target.team_key,'teamConfirmed',target.team_confirmed,'allowedModules',to_jsonb(target.allowed_modules));
end; $$;
revoke all on function public.mfp_admin_update_user_access(uuid,text,text,text) from public,anon;
grant execute on function public.mfp_admin_update_user_access(uuid,text,text,text) to authenticated;
