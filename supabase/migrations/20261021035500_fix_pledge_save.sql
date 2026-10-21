create or replace function public.mfp_save_pledge(p_signature text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); sig text:=btrim(coalesce(p_signature,'')); ts timestamptz:=now();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if char_length(sig)<2 then raise exception 'Full name is required as signature'; end if;
  perform public.mfp_ensure_profile();
  update public.mfp_user_profiles
  set preferences=coalesce(preferences,'{}'::jsonb)||jsonb_build_object('pledgeAccepted',true,'pledgeSignature',sig,'pledgeAcceptedAt',ts),updated_at=ts
  where user_id=uid;
  if not found then raise exception 'User profile missing after profile initialization'; end if;
  return jsonb_build_object('success',true,'pledgeAccepted',true,'pledgeSignature',sig,'pledgeAcceptedAt',ts);
end; $$;
revoke all on function public.mfp_save_pledge(text) from public,anon;
grant execute on function public.mfp_save_pledge(text) to authenticated;
notify pgrst,'reload schema';
