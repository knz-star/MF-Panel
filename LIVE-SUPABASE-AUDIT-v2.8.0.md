# Live Supabase status — 2026-10-18 (post-migration verification)

Project: `nvzvyzgantmtwjfnrqdo` (`MF Links Panel`, `eu-west-3`). This status supersedes the earlier read-only audit in `LIVE-SUPABASE-AUDIT-v2.7.0.md` for the objects specifically listed below.

## Post-update verification

| Check | Result |
|---|---|
| Project | `ACTIVE_HEALTHY` |
| `mfp_team_admin_assignments` | Present; RLS enabled; no client-role access granted by this migration; service role granted |
| `mfp_team_score_warnings` | Present; RLS enabled; no client-role access granted by this migration; service role granted |
| `mfp_team_trend_alerts` | Present; RLS enabled; no client-role access granted by this migration; service role granted |
| Workflow document index | Present |
| Test-data document index | Present |
| Test-data guard trigger | Present on `mfp_documents` |
| Existing `mfp-evidence-linking` | Active, version 10, `verify_jwt=false`; the function body is responsible for validating requests |
| Existing `mfp-evidence-performance` | Active, version 3 |
| `mfp-team-analytics` | Not deployed at audit time |
| `mfp-workflow-control` | Not deployed at audit time |
| `mfp-score-scheduler` | Not deployed at audit time; cron/secret not configured by this update |

## Existing findings still needing review

Supabase security advisors still report a SECURITY DEFINER view (`public.app_registrations`), multiple SECURITY DEFINER RPCs executable by client roles, and exposed tables with RLS enabled but no policies. These are pre-existing issues and were not changed blindly because this project also hosts unrelated MF Links functionality. See the clickable remediation links returned by Supabase Security Advisors for each finding.

## Validation boundaries

Only the two additive migrations were applied during this update. No user rows or unrelated MF Links records were deleted. Frontend build, Edge Function deployment, browser E2E, scheduler execution, and Android pairing E2E remain pending. See `BACKEND-UPDATE-REPORT-v2.8.0.md`.
