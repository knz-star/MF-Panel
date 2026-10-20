# MF MPanel v2.13.0 — Website RPC & Team Isolation Fix

- Replaced website browser Edge Function calls with authenticated Postgres RPC calls through `mfp_web_api`.
- Added `mfp_select_team`, which verifies membership before changing the active team used by RLS.
- Profile hydration now reads canonical `mfp_user_profiles` first, then merges non-authoritative pledge/display metadata from the legacy document mirror. This fixes stale legacy team fields causing Evidence redirects.
- Evidence selection routes directly to `/dashboard/evidence-linking` rather than the old performance redirect.
- Users with multiple authorized workspaces are shown the team chooser from `/dashboard`; users with one team are routed to that team's dashboard.
- The app shell shows only the active team's navigation plus shared reports/profile, and the switcher persists the active team before navigating.
- Removed non-mobile Edge Function source from the website deployment tree. `mobile-compat/mfp-evidence-linking` is retained as reference for the already-deployed, unchanged Android pairing bridge; the website no longer invokes it.

## Required deployment

Apply migrations in timestamp order through `20261020133000_mfp_web_rpc_replacements.sql`, then build and deploy the website. Do not delete the already-deployed Android pairing endpoint unless the Android app is separately migrated and tested.

## Verification status

Source audit and archive integrity can be checked locally. Full Vite build was not verified because dependency installation timed out in the build environment. Test the SQL migration in staging before production; this package has not been deployed to Netlify or applied to the live database.
