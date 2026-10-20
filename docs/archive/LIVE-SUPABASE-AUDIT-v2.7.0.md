# Live Supabase read-only audit — 2026-10-18

Project: `nvzvyzgantmtwjfnrqdo` (`MF Links Panel`, `eu-west-3`). This audit used read-only metadata and SQL queries. No live data/schema/function was changed.

## Findings

| Check | Result | Evidence |
|---|---|---|
| Supabase project | PASS | Project exists and status reports `ACTIVE_HEALTHY`. |
| `mfp_documents` | PASS / LIMITED | Table exists, RLS enabled, 2 rows at audit time. Both rows belong to the `users` collection; no workflow profile/post/checking rows were present. |
| `mfp_user_profiles` | PASS / LIMITED | Table exists, RLS enabled, 2 rows at audit time. |
| Workflow normalized tables | FAIL | `mfp_profiles`, `mfp_posts`, `mfp_checking_records`, `mfp_workflow_events`, `mfp_audit_logs`, and `mfp_reports` were absent from `public`. |
| Document sync trigger | FAIL | `mfp_documents` had protection/update triggers but no `mfp_sync_workflow_document` trigger. The legacy normalized-table mirror is therefore not active in the live schema. |
| Team analytics schema | FAIL | `mfp_team_admin_assignments`, `mfp_team_score_warnings`, and `mfp_team_trend_alerts` were absent. The corresponding migration is not in the live migration list. |
| Team analytics Edge Function | FAIL | `mfp-team-analytics` was not present in the deployed Edge Function list. |
| Workflow-control / scheduler functions | NOT DEPLOYED | New `mfp-workflow-control` and `mfp-score-scheduler` are included in the source package only. |
| Evidence pairing schema | PASS / NEEDS TEST | `mfp_evidence_pairing_requests`, attempt limits, app registrations and connection events exist. The live `mfp-evidence-linking` function is v10. |
| Pairing request freshness | FAIL AT AUDIT TIME | The three `PENDING` pairing requests were all expired at audit time; old codes cannot be redeemed and must be regenerated. |
| Pairing public-key detection | LIKELY ROOT CAUSE IDENTIFIED | Live v10 only compares the incoming Bearer token with the selected anon key. If the app sends `sb_publishable_...` while `SUPABASE_ANON_KEY` is also set, the key can be mistaken for a user token and rejected. The package compares against both configured public-key values and accepts compatible action aliases. |
| Notifications table | PASS | `mfp_web_notifications` contains the expected `user_id`, `title`, `message`, `notification_type`, `is_read`, and `created_at` columns. |
| MF Links data | PRESERVED | No delete/update/reset query was run. |

## Interpretation

The live project is only partially aligned with the current website source. The workflow document store exists, but the legacy normalized tables/sync trigger and team analytics objects are missing. The v2.7.0 intake implementation therefore reads and writes workflow documents directly and does not depend on the missing `mfp_profiles` table.

## What has not been done

- No migration applied to production.
- No Edge Function deployed or overwritten.
- No data deleted, changed, or reset.
- No Android source file changed.
- No live Android redemption test or browser end-to-end test run.

Apply the reviewed migrations and deploy the functions from the v2.7.0 package, then run the deployment smoke tests before team handoff.
