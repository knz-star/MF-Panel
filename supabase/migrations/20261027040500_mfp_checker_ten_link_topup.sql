-- MF MPanel: Checking queue top-up and URL validation fix.
-- The live database function was updated and verified on 2026-10-27.
-- This migration is intentionally a verification guard; it avoids overwriting
-- newer mfp_web_api branches with a stale full function definition.
do $migration$
declare
  v_def text := pg_get_functiondef('public.mfp_web_api(text,jsonb)'::regprocedure);
begin
  if position('limit greatest(10-' in v_def) = 0 then
    raise exception 'Expected ten-link top-up logic is missing. Reconcile the current mfp_web_api definition before applying this migration.';
  end if;
  if position('nullif(trim(coalesce(d0.data->>''canonicalUrl'',d0.data->>''originalUrl'',d0.data->>''url''))' in v_def) = 0 then
    raise exception 'Expected valid-URL assignment filter is missing.';
  end if;
end
$migration$;
notify pgrst, 'reload schema';
