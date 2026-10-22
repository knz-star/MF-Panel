-- Allow multiple admins per team, list-based assignment, and inactivity-aware score decay.
begin;
alter table public.mfp_team_admin_assignments drop constraint if exists mfp_team_admin_assignments_pkey;
alter table public.mfp_team_admin_assignments add constraint mfp_team_admin_assignments_pkey primary key (team_key,admin_user_id);

do $migration$
declare v_def text; v_start int; v_end int; v_branch text;
begin
  select pg_get_functiondef('public.mfp_web_api(text,jsonb)'::regprocedure) into v_def;
  v_start:=position('if action=''assignTeamAdmin'' then' in v_def);
  v_end:=position('elsif action=''reviewLowScore'' then' in v_def);
  if v_start=0 or v_end=0 or v_end<=v_start then raise exception 'Could not safely locate team-admin assignment branch'; end if;
  v_branch := $branch$if action='assignTeamAdmin' then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      v_team := p_payload->>'team';
      if v_team is null or v_team not in ('searching','checking','reports','evidence') then raise exception 'Invalid team'; end if;
      if jsonb_typeof(p_payload->'userIds') is distinct from 'array' then raise exception 'Please update the website before managing team administrators'; end if;
      if exists(select 1 from jsonb_array_elements_text(p_payload->'userIds') x where x=uid::text) then raise exception 'The senior administrator cannot assign themselves as a team lead'; end if;
      if exists(select 1 from jsonb_array_elements_text(p_payload->'userIds') x left join public.mfp_user_profiles up on up.user_id=x::uuid where up.user_id is null or up.account_status<>'ACTIVE' or up.role not in ('ADMIN','TEAM_ADMIN')) then raise exception 'Choose only active accounts with ADMIN or TEAM_ADMIN role'; end if;
      if exists(select 1 from jsonb_array_elements_text(p_payload->'userIds') x join public.mfp_team_admin_assignments ta on ta.admin_user_id=x::uuid where ta.team_key<>v_team) then raise exception 'Each Team Admin can be assigned to one team only'; end if;
      for rec in select * from public.mfp_team_admin_assignments ta where ta.team_key=v_team and not exists(select 1 from jsonb_array_elements_text(p_payload->'userIds') x where x::uuid=ta.admin_user_id)
      loop
        delete from public.mfp_team_admin_assignments where team_key=rec.team_key and admin_user_id=rec.admin_user_id;
        if not exists(select 1 from public.mfp_team_admin_assignments where admin_user_id=rec.admin_user_id) then
          update public.mfp_user_profiles set role=case when rec.previous_role='TEAM_ADMIN' then 'ADMIN' else coalesce(rec.previous_role,'ADMIN') end,team_key=null,team_confirmed=true,allowed_modules=array['searching','checking','reports','evidence','admin']::text[],updated_at=now() where user_id=rec.admin_user_id;
          update public.mfp_documents set data=data||jsonb_build_object('role',case when rec.previous_role='TEAM_ADMIN' then 'ADMIN' else coalesce(rec.previous_role,'ADMIN') end,'team',null,'teamConfirmed',true,'allowedModules',to_jsonb(array['searching','checking','reports','evidence','admin']::text[]),'updatedAt',now()),team_key=null,updated_at=now() where collection_name='users' and document_id=rec.admin_user_id::text;
        end if;
      end loop;
      for target_uid in select distinct x::uuid from jsonb_array_elements_text(p_payload->'userIds') x
      loop
        select * into profile_doc from public.mfp_user_profiles where user_id=target_uid;
        insert into public.mfp_team_admin_assignments(team_key,admin_user_id,assigned_by,previous_role,updated_at)
        values(v_team,target_uid,uid,case when profile_doc.role='TEAM_ADMIN' then coalesce((select ta.previous_role from public.mfp_team_admin_assignments ta where ta.team_key=v_team and ta.admin_user_id=target_uid),'ADMIN') else profile_doc.role end,now())
        on conflict(team_key,admin_user_id) do update set assigned_by=uid,updated_at=now();
        update public.mfp_user_profiles set role='TEAM_ADMIN',team_key=v_team,team_confirmed=true,allowed_modules=array[v_team]::text[],updated_at=now() where user_id=target_uid;
        update public.mfp_documents set data=data||jsonb_build_object('role','TEAM_ADMIN','team',v_team,'teamConfirmed',true,'allowedModules',to_jsonb(array[v_team]::text[]),'updatedAt',now()),team_key=v_team,updated_at=now() where collection_name='users' and document_id=target_uid::text;
      end loop;
      return jsonb_build_object('success',true,'team',v_team,'userIds',p_payload->'userIds');
    $branch$;
  v_def:=substr(v_def,1,v_start-1)||v_branch||'elsif action=''reviewLowScore'' then'||substr(v_def,v_end+length('elsif action=''reviewLowScore'' then'));
  execute v_def;
end $migration$;

do $migration$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.mfp_team_analytics_data(text,integer)'::regprocedure) into v_def;
  v_old := $old$'adminName', (select up2.display_name from public.mfp_team_admin_assignments ta join public.mfp_user_profiles up2 on up2.user_id = ta.admin_user_id where ta.team_key = t.team),
        'adminScore', (select mfp_private.member_activity_score(ta.admin_user_id,t.team) from public.mfp_team_admin_assignments ta where ta.team_key = t.team),$old$;
  v_new := $new$'adminName', (select string_agg(coalesce(nullif(up2.display_name,''),up2.email), ', ' order by up2.display_name) from public.mfp_team_admin_assignments ta join public.mfp_user_profiles up2 on up2.user_id = ta.admin_user_id where ta.team_key = t.team),
        'adminIds', coalesce((select jsonb_agg(ta.admin_user_id) from public.mfp_team_admin_assignments ta where ta.team_key = t.team),'[]'::jsonb),
        'adminScore', (select round(avg(mfp_private.member_activity_score(ta.admin_user_id,t.team)),1) from public.mfp_team_admin_assignments ta where ta.team_key = t.team),$new$;
  if position(v_old in v_def)=0 then raise exception 'Expected analytics admin fields not found'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_old := $old$and (admin_ok or user_id = (select admin_user_id from public.mfp_team_admin_assignments where team_key = v_team))$old$;
  v_new := $new$and (admin_ok or user_id in (select admin_user_id from public.mfp_team_admin_assignments where team_key = v_team))$new$;
  if position(v_old in v_def)=0 then raise exception 'Expected analytics admin scope not found'; end if;
  execute replace(v_def,v_old,v_new);
end $migration$;

create or replace function mfp_private.member_activity_score(p_user uuid,p_team text)
returns numeric language sql stable security definer set search_path=public,pg_temp as $function$
with activity as (
 select
 case p_team
  when 'searching' then (select count(*)::numeric from public.mfp_documents d where d.collection_name='profiles' and d.owner_uid=p_user and coalesce(lower(d.data->>'isTestData'),'false')<>'true' and d.created_at>=now()-interval '30 days')
  when 'checking' then (select count(*)::numeric from public.mfp_checking_assignments a where a.checker_id=p_user and a.completed_at>=now()-interval '30 days' and a.status in ('VERIFIED','INVALID','BLOCKED'))
  when 'evidence' then (select count(*)::numeric from public.mfp_evidence_work_items w where w.assigned_to=p_user and w.completed_at>=now()-interval '30 days' and w.status='COMPLETED')
  when 'reports' then (select count(*)::numeric from public.mfp_documents d where d.owner_uid=p_user and d.collection_name in ('organizationReports','reportJobs','reportPackages') and d.created_at>=now()-interval '30 days')
  else 0::numeric end actions,
 case p_team
  when 'searching' then (select max(d.created_at) from public.mfp_documents d where d.collection_name='profiles' and d.owner_uid=p_user and coalesce(lower(d.data->>'isTestData'),'false')<>'true')
  when 'checking' then (select max(a.completed_at) from public.mfp_checking_assignments a where a.checker_id=p_user and a.status in ('VERIFIED','INVALID','BLOCKED'))
  when 'evidence' then (select max(w.completed_at) from public.mfp_evidence_work_items w where w.assigned_to=p_user and w.status='COMPLETED')
  when 'reports' then (select max(d.created_at) from public.mfp_documents d where d.owner_uid=p_user and d.collection_name in ('organizationReports','reportJobs','reportPackages'))
  else null::timestamptz end last_action
)
select case when actions=0 then 0::numeric else round(least(100::numeric,10::numeric*actions)*case when last_action is null then 0.0 when last_action<now()-interval '7 days' then 0.50 when last_action<now()-interval '3 days' then 0.75 else 1.00 end,1)::numeric(5,1) end from activity;
$function$;
revoke all on function mfp_private.member_activity_score(uuid,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
