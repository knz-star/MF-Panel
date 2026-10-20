-- MF MPanel automatic intake/handoff support. Additive only; does not touch MF Links tables.
-- Queue items live in mfp_documents so existing app-facing document-store integration is retained.
create index if not exists mfp_documents_workflow_collection_created_idx
  on public.mfp_documents (collection_name, created_at desc)
  where collection_name in ('profiles','posts','checkingRecords','workflowEvents','adminReviewItems','evidenceAssignments','reportJobs','reportPackages','evidenceTasks');
create index if not exists mfp_documents_test_data_idx
  on public.mfp_documents (collection_name, ((data->>'isTestData')))
  where data ? 'isTestData';
comment on index public.mfp_documents_test_data_idx is 'Supports explicit MF MPanel testing-data cleanup; only rows tagged isTestData=true are eligible for test-only reset.';


-- Only the senior administrator (or trusted service-role Edge Function) may create test-tagged rows.
create or replace function mfp_private.guard_test_data_flag()
returns trigger language plpgsql set search_path=public,mfp_private,pg_temp as $$
begin
  if auth.uid() is not null and not mfp_private.is_admin() then
    new.data := coalesce(new.data, '{}'::jsonb) - 'isTestData';
  end if;
  return new;
end;
$$;
revoke all on function mfp_private.guard_test_data_flag() from public, anon;
grant execute on function mfp_private.guard_test_data_flag() to authenticated, service_role;
drop trigger if exists mfp_documents_guard_test_data_flag on public.mfp_documents;
create trigger mfp_documents_guard_test_data_flag
before insert or update on public.mfp_documents
for each row execute function mfp_private.guard_test_data_flag();

notify pgrst, 'reload schema';
