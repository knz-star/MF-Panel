# v2.2.0 — Supabase backend migration

- Replaced frontend Firebase SDK usage with Supabase Auth, PostgreSQL-backed workflow storage, Realtime, Storage, and Edge Functions.
- Added isolated `mfp_*` tables and RLS; existing MF Links Panel tables/data remain separate.
- Added role-aware writes for Searching, Checking, Reports, user profiles, and admin-managed assets/settings.
- Added normalized workflow tables synchronized from the app document adapter, including global canonical URL uniqueness for profile/post records.
- Added atomic one-time Evidence pairing redemption, hashed 6-digit codes, 10-minute expiry, active Evidence-team checks, download audit events, and admin connection listing.
- Removed Firebase client/backend deployment artifacts from the active project.
- Added Supabase admin bootstrap and Android integration instructions.

## Validation

- Live Supabase schema check: all 11 `mfp_*` tables have RLS enabled.
- Live Edge Function check: `mfp-evidence-linking` is ACTIVE, version 3, with JWT verification enabled.
- Data isolation check: existing `public.profiles` row count remained 1 and `public.links` row count remained 0; new `mfp_documents`, `mfp_profiles`, and `mfp_user_profiles` are empty until MF MPanel users start using the migrated app.
- Workflow unit tests passed using TypeScript compilation and a JSZip stub for tests that only exercise path-validation logic.
- Full frontend dependency installation, `npm run lint`, and production `npm run build` could not be completed because package registry access timed out and `vite`/`tsx` were unavailable in the environment. Run these in a network-enabled environment before production release.
- Firebase Auth accounts/passwords, Firebase Firestore data, and Android app source were not included in the supplied ZIP and were not migrated.
