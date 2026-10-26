-- MF MPanel v2.16.6: allow Searching to ingest its own post links while retaining Checking-only workflow writes.
-- Applied to production project nvzvyzgantmtwjfnrqdo on 2026-10-26.
create or replace function public.mfp_guard_document_identity_and_status()
returns trigger
language plpgsql
security definer
set search_path = public, auth, mfp_private, pg_temp
as $function$
declare
  admin_ok boolean := mfp_private.is_admin();
  team text := mfp_private.current_team();
  old_status text;
  new_status text;
begin
  if tg_op='UPDATE' and not admin_ok then
    if new.collection_name is distinct from old.collection_name
      or new.document_id is distinct from old.document_id
      or new.owner_uid is distinct from old.owner_uid then
      raise exception 'Document identity and owner cannot be reassigned';
    end if;
    if new.team_key is distinct from old.team_key
      and not (old.collection_name='users' and old.team_key is null and new.team_key=team) then
      raise exception 'Document team cannot be reassigned';
    end if;
  end if;

  if not admin_ok and new.collection_name='profiles' then
    new_status := new.data->>'currentWorkflowStatus';
    old_status := case when tg_op='UPDATE' then old.data->>'currentWorkflowStatus' else null end;
    if team='searching'
      and new_status in ('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED')
      and new_status is distinct from old_status then
      raise exception 'Only Checking Team can set a final profile status';
    end if;
    if tg_op='INSERT' and new_status in ('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED') then
      raise exception 'Profiles cannot be created with a final status';
    end if;
  end if;

  -- Searching can create its own intake post records; it cannot edit posts or
  -- create checkingRecords. Checking/Admin remain the only workflow writers.
  if not admin_ok and new.collection_name in ('posts','checkingRecords') and team<>'checking' then
    if not (
      tg_op='INSERT'
      and new.collection_name='posts'
      and team='searching'
      and new.team_key='searching'
      and new.owner_uid=auth.uid()
      and coalesce(new.data->>'currentWorkflowStatus','SEARCHED') in ('SEARCHED','QUEUED_CHECKING')
    ) then
      raise exception 'Checking Team authorization is required for posts/checking records';
    end if;
  end if;
  return new;
end;
$function$;
notify pgrst, 'reload schema';
