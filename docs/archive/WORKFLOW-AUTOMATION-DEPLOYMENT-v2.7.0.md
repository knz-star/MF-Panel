# MF MPanel v2.7.0 — Workflow automation, reset controls and score enforcement

## What changed
- Searching intake accepts pasted WhatsApp/chat text and automatically submits normalized links to a server-side Edge Function.
- New unique links are inserted into the Checking queue immediately (`QUEUED_CHECKING`). Repeated or existing canonical URLs and invalid URLs create `adminReviewItems` instead of being silently skipped.
- Checking `VERIFIED` creates an `evidenceAssignments` item with `PENDING_ASSIGNMENT`. `FAILED_BLOCKED` creates an Admin Review item.
- Senior-admin-only Workflow Review & Reset page supports review decisions, a preview, test-only cleanup for records explicitly tagged `isTestData=true`, and a separate destructive MF MPanel workflow reset.
- New scheduled score evaluator disables active non-admin team members with score below 25% and creates a score warning + admin notifications. An administrator's `KEPT_ACTIVE` review is respected until the score recovers to at least 25%.
- Android application source is not modified. The live database has received only the two additive migrations listed below. No existing rows were deleted or reset.
- Pairing fix: the previous live `mfp-evidence-linking` v10 compares the incoming Bearer key only against the selected anon key. When Android sends a newer `sb_publishable_...` key while `SUPABASE_ANON_KEY` is also configured, it can be misclassified as a user JWT and rejected. The new function compares against both public-key environment values and supports action-name aliases.

## Deploy to Supabase
Use the existing project `nvzvyzgantmtwjfnrqdo`. Review and apply migrations in chronological order, including:
- `20261018070000_mfp_team_analytics_admins.sql`
- `20261018080000_mfp_auto_workflow_queues.sql`

Deploy the functions (including the updated existing pairing endpoint):
```sh
supabase functions deploy mfp-evidence-linking
supabase functions deploy mfp-team-analytics
supabase functions deploy mfp-workflow-control
supabase functions deploy mfp-score-scheduler
```
The functions need the normal Supabase environment values `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase supplies to deployed functions. Never place the service-role key in frontend `.env` files or client code.

## Enable background score checks
The app can evaluate a user's score when the profile/analytics endpoint is opened, but true background disabling requires the scheduler to be invoked periodically. Set a strong, unique secret in Supabase Function secrets:
```sh
supabase secrets set MFP_SCORE_CRON_SECRET="<generate-a-long-random-secret-and-store-it-securely>"
```
Configure a trusted scheduler (for example, a secured external cron service) to POST every 15 minutes to:
`https://nvzvyzgantmtwjfnrqdo.supabase.co/functions/v1/mfp-score-scheduler`
with header `x-mfp-cron-secret: <the same secret>` and `content-type: application/json`. Do not place this secret in the website frontend. A missing or incorrect secret returns 401. Until a scheduler is configured, this function is deployed but background evaluation is not active.

## Safe testing/reset
1. Use the senior-admin-only Searching intake checkbox `Mark this batch as TEST DATA` for test URLs.
2. Open `/admin/workflow-control` and check the preview counts.
3. `Clear testing data only` deletes only workflow records tagged `isTestData=true`.
4. `Reset all MF MPanel data` is destructive: it clears workflow records, Evidence metadata, pairing codes and app registrations, and requires typing `RESET ALL MF MPANEL DATA`.

Both reset modes are restricted server-side to the senior admin. The full reset preserves Supabase Auth users, MF MPanel roles/profiles, team-admin assignments, website settings/platform catalog, unrelated MF Links tables/data, Supabase Storage assets and local Android evidence files. It clears app pairing/registration rows and is not a full Supabase project wipe.

## Required smoke tests before production use
- Paste one new canonical URL: it should appear in Checking automatically.
- Paste the same URL twice in one batch, then paste it again in another batch: duplicates should appear in Admin Review.
- Paste malformed URL text: it should appear in Admin Review as invalid.
- Submit Checking `VERIFIED`: verify a `PENDING_ASSIGNMENT` item appears in Evidence assignment queue.
- Submit Checking `FAILED_BLOCKED`: verify a pending Admin Review item appears.
- Run reset preview, create one tagged test batch, clear test data and confirm only tagged workflow records were removed.
- Confirm an ordinary member cannot invoke reset; confirm the senior admin can.
- Configure the score scheduler and test with a dedicated test account before relying on automated disabling.
- Re-test Android pairing using the unchanged Android app only after deploying migrations/functions; generate a fresh code (the live requests observed during the audit were expired), and do not infer pairing success from a website-only test.

## Important verification status
This package is a source change, not a production deployment. The two additive migrations listed above have been applied and verified. Edge Functions have not yet been deployed from this package. Browser E2E, live RLS validation, real Android pairing and the scheduled evaluator have not been run against production. Run the smoke tests above before team handoff.
