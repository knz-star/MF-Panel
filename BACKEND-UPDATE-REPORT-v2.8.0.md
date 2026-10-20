# MF MPanel v2.8.0 — Live backend update report

Date: 2026-10-18 15:15 UTC  
Supabase project: `nvzvyzgantmtwjfnrqdo` (`eu-west-3`)

## Applied and verified

1. `mfp_team_admin_assignments` — created; RLS enabled; client roles revoked; `service_role` access retained.
2. `mfp_team_score_warnings` — created; RLS enabled; client roles revoked; `service_role` access retained.
3. `mfp_team_trend_alerts` — created; RLS enabled; client roles revoked; `service_role` access retained.
4. `mfp_documents_workflow_collection_created_idx` — created and verified.
5. `mfp_documents_test_data_idx` — created and verified.
6. `mfp_documents_guard_test_data_flag` trigger — created and verified.
7. `mfp_user_profiles.role` constraint now permits `USER`, `ADMIN`, `TEAM_ADMIN`, `CHECKER`, and `SEARCHER`; the existing live roles at migration time were `USER` and `ADMIN`.

These migrations are additive. No user/account rows, MF Links records, evidence files, pairing rows, or Storage objects were intentionally deleted or reset.

## Current live status observed

- Existing `mfp-evidence-linking` Edge Function: active, version 10, `verify_jwt=false` (function source performs its own request validation; re-test before relying on app pairing).
- Existing `mfp-evidence-performance`: active, version 3.
- `mfp-team-analytics`, `mfp-workflow-control`, and `mfp-score-scheduler` were not present in the live function list during this update.
- The new function source for those endpoints is included in this ZIP, but has **not** been deployed. The scheduler secret/periodic invocation is also not configured by this update.
- The security advisor still reports pre-existing findings, including `public.app_registrations` as a SECURITY DEFINER view, several SECURITY DEFINER RPCs executable by client roles, and exposed tables with RLS but no policies. These need a separate targeted review; they were not changed blindly because the project also contains unrelated MF Links functionality.

## Validation limits

- Database objects were checked after migration.
- `npm test` could not run because dependencies were absent (`tsx: not found`); `npm install` timed out in this environment.
- Full `npm run lint`, `npm run build`, browser end-to-end tests, Edge Function deployment, scheduled score evaluation, and Android app pairing were not completed. Do not treat this package as fully production-certified until those checks pass.

## Next deployment steps

1. Install dependencies in a network-enabled environment, then run `npm run lint`, `npm test`, and `npm run build`.
2. Review the function sources and deploy `mfp-team-analytics` and `mfp-workflow-control` to the existing project.
3. Configure `MFP_SCORE_CRON_SECRET` securely, deploy `mfp-score-scheduler`, and configure a trusted 15-minute scheduler.
4. Test the entire workflow with a dedicated test account: paste → duplicate/invalid review → Checking verified → Evidence queue → reports; then test role scoping and reset preview.
5. Finally test the unchanged Android app with a newly generated pairing code. Do not modify Android source as part of this package.
