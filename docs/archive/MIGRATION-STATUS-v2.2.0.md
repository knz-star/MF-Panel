# MF MPanel v2.2.0 — Supabase migration status

## Backend
- Supabase project: `nvzvyzgantmtwjfnrqdo` (`eu-west-3`).
- Website configuration uses the public project URL and publishable key. Never put a service-role/secret key in `VITE_*` or browser code.
- Added isolated `mfp_*` tables, row-level security, profile/team guard triggers, normalized workflow tables and a `mfp_documents` compatibility store.
- Added `mfp-evidence-linking` Edge Function, deployed as version 2 with JWT verification enabled.
- Evidence pairing codes are short-lived, hashed at rest, rate-limited to three pending requests, and consumed through a row-locked SQL function to prevent concurrent reuse.
- Supabase Storage bucket `mfp-assets` is separate from existing buckets; admin write policies protect uploads.
- The original MF Links Panel tables/data were not overwritten. Live verification showed existing `public.profiles` still has 1 row and `public.links` still has 0 rows; the new MF MPanel document/profile tables start empty.

## Important migration limitations
- The supplied ZIP contains website source, not a Firebase export. Existing Firebase Auth users/passwords and Firestore documents have **not** been imported. Firebase passwords cannot generally be transferred; users must create/confirm Supabase Auth accounts or use a planned account recovery process.
- The Android Evidence app source was not in this ZIP. It must migrate to Supabase Auth and call `mfp-evidence-linking` with the signed-in Supabase session. Firebase ID tokens are not accepted by this Edge Function.
- Local browser cache data is not a substitute for server migration. Export/import any needed Firebase data separately before deleting the old Firebase project.
- A local production build/test could not run in this environment because npm dependencies were unavailable and package registry access timed out. TypeScript parser check passed after fixing a syntax issue, but a full typecheck/build is not yet verified.

## Required next steps
1. Install dependencies with `npm install`; run `npm run lint`, `npm test`, and `npm run build`.
2. Bootstrap the first admin using `SUPABASE_ADMIN_BOOTSTRAP.md`.
3. Test signup/email confirmation, sign-in, one-time team selection, cross-team workflow reads, profile/post import, report creation, asset uploads, pairing, redeem-on-Android, Get Links, revocation and admin connection listing.
4. Update the Android app's authentication and linking screen to use Supabase Auth and the action contract in `EVIDENCE-APP-INTEGRATION.md`.
5. Only after regression tests pass should the Netlify production site be updated.
