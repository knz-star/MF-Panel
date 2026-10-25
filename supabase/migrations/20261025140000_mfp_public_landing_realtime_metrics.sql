-- Public landing page receives aggregate counts only; no URLs, user data, or internal notes.
create or replace function public.mfp_public_landing_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'totalLinks', (select count(*)::bigint from public.mfp_documents d where d.collection_name in ('profiles','posts') and coalesce(lower(d.data->>'isTestData'),'false') <> 'true'),
    'checkedLinks', (select count(*)::bigint from public.mfp_checking_assignments ca where upper(ca.status) in ('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED')),
    'evidenceAnalyzed', (select count(distinct r.assignment_id)::bigint from public.mfp_link_upload_receipts r)
  );
$$;
revoke all on function public.mfp_public_landing_metrics() from public;
grant execute on function public.mfp_public_landing_metrics() to anon, authenticated;
