create or replace function mfp_private.member_activity_score(p_user uuid, p_team text)
returns numeric language sql stable security definer set search_path = public, pg_temp
as $fn$
  select least(100::numeric, 10::numeric * (case p_team
    when 'searching' then (select count(*)::numeric from public.mfp_documents d where d.collection_name='profiles' and d.owner_uid=p_user and coalesce(lower(d.data->>'isTestData'),'false') <> 'true' and d.created_at >= now() - interval '24 hours')
    when 'checking' then (select count(*)::numeric from public.mfp_checking_assignments a where a.checker_id=p_user and a.completed_at >= now() - interval '24 hours' and a.status in ('VERIFIED','INVALID','BLOCKED'))
    when 'evidence' then (select count(*)::numeric from public.mfp_evidence_work_items w where w.assigned_to=p_user and w.completed_at >= now() - interval '24 hours' and w.status='COMPLETED')
    when 'reports' then (select count(*)::numeric from public.mfp_documents d where d.owner_uid=p_user and d.collection_name in ('organizationReports','reportJobs','reportPackages') and d.created_at >= now() - interval '24 hours')
    else 0::numeric end))::numeric(5,1);
$fn$;
revoke all on function mfp_private.member_activity_score(uuid,text) from public, anon, authenticated;

do $patch$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.mfp_team_analytics_data(text,integer)'::regprocedure) into v_def;
  v_old := 'where up.team_key = any(scope_teams) and up.account_status in (''ACTIVE'',''DISABLED'') and (not self_only or up.user_id = uid)';
  v_new := 'where up.team_key = any(scope_teams) and up.account_status in (''ACTIVE'',''DISABLED'') and (admin_ok or up.gender_group = p.gender_group) and (not self_only or up.user_id = uid)';
  if position(v_old in v_def)=0 then raise exception 'Analytics gender-scope patch target not found; migration aborted'; end if;
  v_def := replace(v_def,v_old,v_new);
  v_old := $old$'score', case when coalesce(x.c,0) + coalesce(x.f,0) = 0 then null else round(100.0*x.c/(x.c+x.f),1) end,$old$;
  v_new := $new$'score', mfp_private.member_activity_score(m.user_id,m.team),$new$;
  if position(v_old in v_def)=0 then raise exception 'Member activity-score patch target not found; migration aborted'; end if;
  v_def := replace(v_def,v_old,v_new);
  v_old := $old$'score', (select case when x.c + x.f = 0 then null else round(100.0*x.c/(x.c+x.f),1) end from mt x where x.user_id = uid),$old$;
  v_new := $new$'score', mfp_private.member_activity_score(uid,p.team_key),$new$;
  if position(v_old in v_def)=0 then raise exception 'Personal activity-score patch target not found; migration aborted'; end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end
$patch$;
comment on function mfp_private.member_activity_score(uuid,text) is 'Activity score from real work in rolling 24h: 10 points per link action, capped at 100.';
notify pgrst, 'reload schema';
