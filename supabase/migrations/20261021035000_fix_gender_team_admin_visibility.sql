-- Admins can review pending/disabled accounts in gender-group views; group leads only see active members.
do $block$
declare v_def text;
begin
  v_def:=pg_get_functiondef('public.mfp_web_api(text,jsonb)'::regprocedure);
  v_def:=replace(v_def,'where up.gender_group=gender and up.account_status=''ACTIVE''','where up.gender_group=gender and (admin_ok or up.account_status=''ACTIVE'')');
  v_def:=replace(v_def,'where gender_group=gender and account_status=''ACTIVE''','where gender_group=gender and (admin_ok or account_status=''ACTIVE'')');
  execute v_def;
end;
$block$;
notify pgrst,'reload schema';
