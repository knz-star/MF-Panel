-- Organization report sharing: users can read only reports explicitly shared with their assigned team.
-- Existing admin/owner/team workflow access remains unchanged.
alter table public.mfp_documents enable row level security;
drop policy if exists mfp_documents_select on public.mfp_documents;
create policy mfp_documents_select on public.mfp_documents
for select to authenticated
using (
  (select mfp_private.is_admin())
  or owner_uid = (select auth.uid())
  or (team_key is not null and team_key = (select mfp_private.current_team()))
  or collection_name in ('profiles','posts','checkingRecords','workflowEvents','reportJobs','reportPackages','settings','landingAssets','siteSettings')
  or (collection_name = 'organizationReports' and coalesce(data->'sharedTeams', '[]'::jsonb) ? (select mfp_private.current_team()))
);
comment on policy mfp_documents_select on public.mfp_documents is 'Admin/owner/team workflow access plus explicit team-shared organization reports.';
