-- Allow any active ADMIN or TEAM_ADMIN to lead either gender group.
-- The group assignment is an administrative responsibility, not a restriction on the lead's own gender.
do $block$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.mfp_web_api(text,jsonb)'::regprocedure);
  v_def := replace(v_def,
    $old$if not exists(select 1 from public.mfp_user_profiles where user_id=target_uid and role in ('ADMIN','TEAM_ADMIN') and account_status='ACTIVE' and gender_group=gender) then raise exception 'Choose an active same-gender Team Admin'; end if;$old$,
    $new$if not exists(select 1 from public.mfp_user_profiles where user_id=target_uid and role in ('ADMIN','TEAM_ADMIN') and account_status='ACTIVE') then raise exception 'Choose an active ADMIN or TEAM_ADMIN'; end if;$new$);
  if v_def not like '%Choose an active ADMIN or TEAM_ADMIN%' then
    raise exception 'Could not safely patch gender-team lead validation; review current mfp_web_api definition.';
  end if;
  execute v_def;
end;
$block$;
notify pgrst, 'reload schema';
