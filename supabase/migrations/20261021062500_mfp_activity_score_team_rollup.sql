do $patch$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.mfp_team_analytics_data(text,integer)'::regprocedure) into v_def;
  v_old := $old$'adminScore', (select case when mt2.c + mt2.f = 0 then null else round(100.0*mt2.c/(mt2.c+mt2.f),1) end from public.mfp_team_admin_assignments ta join mt mt2 on mt2.user_id = ta.admin_user_id where ta.team_key = t.team),$old$;
  v_new := $new$'adminScore', (select mfp_private.member_activity_score(ta.admin_user_id,t.team) from public.mfp_team_admin_assignments ta where ta.team_key = t.team),$new$;
  if position(v_old in v_def)=0 then raise exception 'Admin activity-score target not found'; end if;
  v_def := replace(v_def,v_old,v_new);
  v_old := $old$'score', (select case when ts.c + ts.f = 0 then null else round(100.0*ts.c/(ts.c+ts.f),1) end from tsum ts where ts.team = t.team),$old$;
  v_new := $new$'score', (select round(avg(mfp_private.member_activity_score(mm.user_id,mm.team)),1) from m mm where mm.team=t.team and mm.status='ACTIVE'),$new$;
  if position(v_old in v_def)=0 then raise exception 'Team activity-score target not found'; end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end
$patch$;
notify pgrst, 'reload schema';
