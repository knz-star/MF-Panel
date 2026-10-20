# MF MPanel v2.8.4 — Source and live-backend audit

Audit date: 2026-10-19 (UTC)

## Confirmed live findings

- Supabase project ref: `nvzvyzgantmtwjfnrqdo`.
- The live Edge Function inventory returned these ACTIVE functions: `connector-gateway`, `ai-control`, `rss-worker`, `ai-model-sync`, `ai-worker`, `mfp-evidence-linking`, `mfp-evidence-performance`.
- The live inventory did **not** include `mfp-team-analytics` or `mfp-workflow-control`. Frontend services call those names for profile scoring/team analytics and workflow control/system-reset preview/actions. This explains the known reachability errors on those flows.
- Live table inventory includes `mfp_user_profiles`, `mfp_documents`, `mfp_evidence_activity_events`, `mfp_team_admin_assignments`, `mfp_team_score_warnings`, pairing tables, and the Evidence metadata tables. Counts were observed but no rows were modified.
- `mfp-score-scheduler` source exists locally but was not in the live Edge Function inventory. It is not included in the two-function deployment script because scheduler/cron configuration and its secret need a separate, deliberate setup.

## Changes in v2.8.4

- Improved the error diagnostics so “Failed to send a request to the Edge Function”, “could not be reached”, and missing-function errors are classified as Edge Function failures rather than falling through to “UNKNOWN”. Diagnostics now point to the relevant function when its name is present and no longer point every function failure only at Evidence Linking.
- Added `npm run audit:source` to verify that literal frontend Edge Function invocations have local source folders.
- Hardened `scripts/deploy-required-functions.sh`: it checks CLI authentication, runs the source audit, deploys only the two missing functions, then verifies that both appear in the remote function inventory.
- Preserved the low-score warning-only behavior. A low score does not automatically disable an account.
- No database migrations, data resets, Auth-account changes, or Android source changes were made.

## Validation status / limits

- Live Supabase function inventory was checked through the connected Supabase integration.
- The package manager install did not finish within the available command timeout, so a full dependency-backed Vite build, TypeScript check, and test suite could not be certified in this run.
- The exact production website URL was not present in the supplied project ZIP or recent project context, so a live browser UI smoke test against the correct deployment could not be responsibly claimed.
- The two missing Edge Functions are included as source in this ZIP but are **not deployed by creating this ZIP**. Run `supabase login` and `bash scripts/deploy-required-functions.sh` from the extracted project directory, then test the two affected flows. Do not run a system reset as part of testing.

## Protected boundaries

This release does not change the Android app repository/source. It does not delete or reset live data. The system-reset function remains a privileged, explicit-confirmation operation and should only be used after reviewing its preview.
