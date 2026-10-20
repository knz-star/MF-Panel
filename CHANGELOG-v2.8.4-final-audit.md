# v2.8.4 — Final audit and Edge Function recovery

- Fixed frontend diagnostics for Supabase Edge Function reachability errors.
- Added a source audit for frontend-to-function references.
- Added deploy-and-verify flow for the two missing production functions: `mfp-team-analytics` and `mfp-workflow-control`.
- Kept low-score behavior warning-only; no automatic account disabling.
- No Android app source changes and no live database mutations.
- Read `AUDIT-REPORT-v2.8.4.md` before deployment; live deployment still requires the authenticated Supabase CLI.
