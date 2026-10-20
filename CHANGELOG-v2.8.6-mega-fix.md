# MF MPanel v2.8.6 — Mega Fix pass

## Changes in this package
- Centralized Supabase Edge Function calls with one bounded retry for transient/network errors and friendly user-facing messages.
- Profile save verifies the persisted name after a reported update error to prevent false failure banners.
- Evidence App Linking explicitly checks Evidence workspace access, matching the Evidence performance route.
- Navigation labels distinguish Searching, Checking, and Reports workspaces.
- Existing Report Generator ZIP analysis pipeline, pledge flow, authentication model, and route protection were not intentionally replaced.

## Production verification boundary
- The live Supabase inventory showed `mfp-evidence-performance` deployed, while `mfp-team-analytics` and `mfp-workflow-control` were absent at the time of the audit.
- Run the deployment script from this project directory after `supabase login`; verify both function names in Supabase after deployment.
- This ZIP alone does not prove Netlify has been rebuilt or that acceptance tests passed against production.

- Added explicit email-confirmation error handling and a resend-confirmation action on sign-in.
- Added breadcrumb navigation and an acceptance source-smoke test.
- Deployment script now includes Evidence linking/performance functions as well as team analytics/workflow control.

- Added a read-only authenticated `health` action to Workflow Control for System Health probing.
