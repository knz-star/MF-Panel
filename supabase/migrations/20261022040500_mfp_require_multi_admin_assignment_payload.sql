-- Reject stale website clients still sending the former single-user assignment payload.
do $migration$
declare v_def text;
begin
 select pg_get_functiondef('public.mfp_web_api(text,jsonb)'::regprocedure) into v_def;
 if position('if jsonb_typeof(p_payload->''userIds'') is distinct from ''array'' then raise exception ''Please update the website before managing team administrators'';' in v_def)=0 then
   raise exception 'Expected assignment payload validation not found';
 end if;
 -- This is intentionally idempotent: the main migration already installs the strict validation.
end $migration$;
