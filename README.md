# MF MPanel v2.3.1 — Evidence Dashboard, Activity Score & Pairing

MF MPanel is a Vite + React + TypeScript workflow dashboard for Searching, Checking, Evidence linking and report preparation. This version moves website authentication, workflow persistence, Storage uploads and Evidence linking from Firebase to Supabase.

## Supabase target
- Project: `nvzvyzgantmtwjfnrqdo`
- Region: `eu-west-3`
- Client configuration: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Edge Function: `mfp-evidence-linking` (`verify_jwt = true`)
- Storage bucket: `mfp-assets`

The public publishable key is safe for browser configuration when RLS is enabled. **Never place a Supabase service-role/secret key in frontend code, `.env` variables prefixed with `VITE_`, or this ZIP.**

## Architecture
- `src/lib/supabase.ts` — Supabase client and public config.
- `src/lib/supabaseDocumentStore.ts` — app-facing document adapter backed by `mfp_documents` and Postgres Realtime.
- `src/lib/supabaseAuthCompat.ts` — temporary compatibility helpers around Supabase Auth.
- `src/lib/supabaseStorageCompat.ts` — Supabase Storage adapter for `mfp-assets`.
- `src/lib/supabaseFunctionsCompat.ts` — callable-style adapter for `mfp-evidence-linking`.
- `supabase/migrations/` — isolated `mfp_*` schema, RLS, profile/team guardrails, normalized workflow tables and triggers.
- `supabase/functions/mfp-evidence-linking/` — Edge Function source deployed to the target project.

The target Supabase project was reset on 2026-10-16: all rows in public application tables and all Supabase Auth users were cleared while database schemas, table definitions, RLS policies, functions, migrations, and deployed Edge Functions were preserved. Storage object count verified as zero; three Storage bucket definitions remain. Review `RESET-REPORT-v2.2.1.md` before use. MF MPanel writes its workflow data to `mfp_*` tables only.

## Evidence dashboard routes

Canonical routes are `/dashboard/evidence-linking` and `/dashboard/get-links`. Compatibility routes `/evidence`, `/evidence/dashboard`, and `/dashboard/evidence` now open the Evidence Performance Dashboard; Evidence team login redirects there automatically. Pairing stays at `/dashboard/evidence-linking`, and `/evidence/get-links` remains available for link downloads.

Pairing codes are six numeric digits (leading zeroes are valid), expire after 10 minutes, are stored as SHA-256 hashes, and can be redeemed only once by the same authenticated account. Repeated app linking uses the latest registration record so old revoked records do not break the dashboard.

## Setup

```sh
npm install
npm run dev
```

Before deploying the website, run:

```sh
npm run lint
npm test
npm run build
```

Set these Netlify environment variables if you do not want to use the safe public defaults in `src/lib/supabase.ts`:

- `VITE_SUPABASE_URL=https://nvzvyzgantmtwjfnrqdo.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

**Backend status (2026-10-18):** the additive migrations `mfp_team_analytics_admins_20261018` and `mfp_auto_workflow_queues_20261018` were applied and verified in the specified Supabase project. The new workflow/analytics/scheduler Edge Functions are included as source but are **not yet deployed**; the existing `mfp-evidence-linking` function remains at live version 10. See `BACKEND-UPDATE-REPORT-v2.8.0.md` for verified facts and remaining deployment/tests.

## Default administrator

`knzbro602@gmail.com` is configured as the intended default administrator. The live `mfp_user_profiles` record is `ADMIN` and `ACTIVE` with all module permissions. The server-side `mfp_ensure_profile()` bootstrap grants this role only when that exact email is confirmed by Supabase Auth. Other users cannot promote themselves. Sign out and back in after an admin role change so the UI refreshes permissions.

## Evidence app

See `EVIDENCE-APP-INTEGRATION.md` for the Edge Function request contract. The Android source was not in the uploaded website ZIP; it must migrate to Supabase Auth before Firebase-issued tokens can be replaced. The Edge Function accepts only a valid Supabase JWT.

## Important migration limits

- Firebase Auth users/passwords and Firestore data were not imported because the supplied ZIP did not include a Firebase data export or trusted Firebase migration credentials. Existing Firebase passwords generally cannot be transferred; account recovery/re-registration is required.
- Local browser cache is not a server backup. Export any required old data before retiring Firebase.
- The project dependencies could not be installed in this environment because package registry access timed out. Static TypeScript parsing was checked, but a full `npm run lint`, `npm test` and `npm run build` still need to run in a network-enabled environment.

See `MIGRATION-STATUS-v2.2.0.md`, `TEST_REPORT-v2.2.0.md`, and `RESET-REPORT-v2.2.1.md` for migration history, validation limits, reset verification, and remaining rollout tasks.

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
