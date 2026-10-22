-- Applied to production via Supabase MCP on 2026-10-22 (additive; no existing data modified).
-- Root cause of "invalid code" in the installed Android app: since the website switched to the mfp_web_api RPC (20261020133000),
-- new pairing codes were written only to mfp_evidence_pairing_requests. The app validates against legacy public.pairing_codes,
-- which the old edge-function createPairing used to fill (last row: 2026-10-19). This function mirrors the code there.
-- Rollback: drop function public.mfp_sync_legacy_pairing_code(uuid, text, text);
create or replace function public.mfp_sync_legacy_pairing_code(p_request_id uuid, p_code text, p_action text default 'create')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  r public.mfp_evidence_pairing_requests%rowtype;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_code !~ '^[0-9]{6}$' then raise exception 'Invalid pairing code format'; end if;
  select * into r from public.mfp_evidence_pairing_requests where id = p_request_id and user_id = auth.uid();
  if not found then raise exception 'Pairing request not found'; end if;
  if encode(digest(p_code, 'sha256'), 'hex') <> r.code_hash then raise exception 'Pairing code does not match its request'; end if;

  if p_action = 'cancel' then
    update public.pairing_codes set is_used = true, used_by = 'cancelled', used_at = now() where code = p_code and not is_used;
    return jsonb_build_object('success', true);
  end if;

  if r.status <> 'PENDING' or r.expires_at <= now() then raise exception 'Pairing request is no longer active'; end if;
  select lower(trim(email)) into v_email from public.mfp_user_profiles where user_id = auth.uid();
  if v_email is null or v_email = '' then raise exception 'Account email is required'; end if;

  delete from public.pairing_codes where code = p_code and (is_used or coalesce(expires_at, now()) <= now());
  insert into public.pairing_codes(code, email, is_used, expires_at) values (p_code, v_email, false, r.expires_at);
  return jsonb_build_object('success', true);
exception when unique_violation then
  raise exception 'Pairing code collision; generate a new code';
end $$;

revoke all on function public.mfp_sync_legacy_pairing_code(uuid, text, text) from public, anon;
grant execute on function public.mfp_sync_legacy_pairing_code(uuid, text, text) to authenticated;
