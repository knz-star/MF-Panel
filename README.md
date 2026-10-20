# MF MPanel v2.13.1 — Website RPC & Team Isolation

MF MPanel is a Vite + React + TypeScript workflow dashboard for Searching, Checking, Evidence linking and organization reporting. The current website source uses authenticated Supabase Postgres RPCs instead of browser calls to Supabase Edge Functions. The existing Android app source has not been changed.

## Supabase target
- Project ref: `nvzvyzgantmtwjfnrqdo`
- Region: `eu-west-3`
- Client configuration: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Database RPCs: `mfp_web_api`, `mfp_select_team`
- Storage bucket: `mfp-assets`

The public publishable key is safe for browser configuration when RLS is enabled. **Never place a Supabase service-role/secret key in frontend code or any `VITE_` variable.**

## Current architecture
- `src/lib/supabase.ts` — Supabase client and public configuration.
- `src/lib/supabaseDocumentStore.ts` — document adapter backed by `mfp_documents` and Postgres Realtime.
- `src/services/webApiClient.ts` — authenticated RPC client for website actions.
- `supabase/migrations/` — isolated `mfp_*` schema, RLS, workflow tables, stable profile/post IDs, and RPC replacements.
- `mobile-compat/mfp-evidence-linking/` — reference source for the already-deployed Android pairing bridge only. It is not a website deployment target. Do not delete the live Android pairing endpoint until the existing Android app is separately migrated and tested.

## Team workspace behavior
- Users with multiple assigned workspaces are shown team selection on first load/sign-in; selecting a team persists the active `team_key` through `mfp_select_team`.
- Users with one assigned workspace are routed directly to that team's dashboard after the active team is confirmed.
- The app shell shows the selected team's work navigation plus shared reports/profile. Direct navigation to a different team route returns to team selection.
- The Evidence button opens `/dashboard/evidence-linking`; it no longer redirects to the Evidence Performance page.
- Admins retain organization-wide access. Team Admin analytics is scoped to the selected/managed team.

## Setup and validation

```sh
npm install
npm run audit:source
npm run test
npm run test:acceptance
npm run lint
npm run build
```

The package includes the migration sequence in `DEPLOYMENT-v2.13.1-RPC-TEAM-ISOLATION.md`. Apply any missing migrations in timestamp order before deploying the frontend. The full Vite build and dependency-backed test suite were not verified in this environment because package installation timed out. The migration and website have not been applied/deployed to production from this workspace.

## Android compatibility note
The Android source is unchanged. Website pairing-code creation now uses the database RPC, while the existing deployed Android bridge is retained for code redemption. Do not delete that live endpoint until the Android client has a separately tested replacement.

## Historical notes
The sections below describe earlier versions and may mention the old Edge Function architecture. For current deployment instructions, use `DEPLOYMENT-v2.13.1-RPC-TEAM-ISOLATION.md`.

## v2.3.1 — Evidence Performance Dashboard

- Added Evidence Performance dashboard routes for team members and administrators.
- Added daily, weekly, monthly and 90-day views for assigned/completed/pending counts, platform breakdown, activity trends and score rate.
- Added protected `mfp-evidence-performance` Edge Function and server-only activity tables.
- Added automatic return-to-pool and Evidence access revocation for qualifying scores below 25; immutable activity history is retained.
- Promoted `knzbro602@gmail.com` to ACTIVE ADMIN in the live MF MPanel profile and added a verified-email bootstrap rule for future profile creation.
- Android per-link event sync is required for live completed/pending metrics; see `EVIDENCE-PERFORMANCE-AND-ANDROID-SYNC-v2.3.1.md`.


## v2.8.0 — Verified additive backend update

See [`BACKEND-UPDATE-REPORT-v2.8.0.md`](./BACKEND-UPDATE-REPORT-v2.8.0.md). Database migrations are applied; Edge Function deployment, full frontend build and Android pairing E2E remain pending.

## v2.7.0 — Automatic workflow and backend repair

See [`WORKFLOW-AUTOMATION-DEPLOYMENT-v2.7.0.md`](./WORKFLOW-AUTOMATION-DEPLOYMENT-v2.7.0.md) for the required Supabase migrations, Edge Function deployment, secure scheduler setup, test cases and reset scope.

- Searching team pastes links once; unique links enter Checking automatically.
- Duplicate/invalid/blocked links are routed to Admin Review.
- Verified Checking records create an Evidence assignment item.
- Admin can clear explicitly tagged test data or perform a separately confirmed full MF MPanel workflow/evidence metadata reset.
- Pairing function recognizes both the legacy anon key and newer publishable key in Android's unauthenticated email + six-digit-code redemption flow. Android source remains unchanged.
- The source package has not been deployed to live Supabase; apply and test the documented migrations/functions before production handoff.

## v2.13.1 — Website RPC & Team Isolation

Website actions now use authenticated Supabase Postgres RPCs instead of Edge Function calls. See `DEPLOYMENT-v2.13.1-RPC-TEAM-ISOLATION.md` for migration order, the unchanged Android pairing bridge note, and the required staging verification steps.
