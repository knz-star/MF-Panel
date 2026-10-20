# Evidence dashboard fix report — v2.2.2

## Website routing
- Added `/evidence` and `/evidence/dashboard` aliases because the team-selection flow navigates to `/${team}` and the `evidence` team previously had no matching route.
- Added `/dashboard/evidence` and `/evidence/get-links` compatibility aliases.
- Kept canonical `/dashboard/evidence-linking` and `/dashboard/get-links` routes.

## Pairing code
- `mfp-evidence-linking` is deployed to Supabase project `nvzvyzgantmtwjfnrqdo`, active version 5, with JWT verification enabled.
- Code is exactly six numeric digits (leading zeroes allowed), generated using cryptographically secure rejection sampling, hashed with SHA-256 before storage, expires in ten minutes, and is one-time use.
- Unique hash collisions are retried; no raw code is stored in the database.
- Evidence registration lookups use the latest `linked_at` row so old revoked registrations do not break a later pairing.

## Validation
- Static route and source assertions passed.
- TypeScript syntax transpilation passed for edited TS/TSX files.
- Supabase Edge Function deployment confirmed active version 5 with `verify_jwt=true`.
- Full `npm run lint`, `npm test`, and `npm run build` could not be run because `npm install` timed out while accessing the package registry; run them in a network-enabled environment before production release.
- The Android source was not included in the website ZIP, so app-side Supabase Auth and redeem-flow integration still needs to be tested against this endpoint.

## First use after full reset
All Auth users were removed in the requested full reset. Create/sign up the intended account again, then follow `SUPABASE_ADMIN_BOOTSTRAP.md` to grant Admin role through the Supabase SQL Editor. Normal users must have an active, confirmed Evidence team assignment before generating a pairing code.
