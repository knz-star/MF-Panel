# v2.2.1 — Fresh reset baseline and bootstrap update

- Reset all rows from every `public` application table in the target Supabase project while preserving schema, constraints, RLS policies, functions, and deployed Edge Functions.
- Deleted all existing Supabase Auth users and their dependent auth records; the previous administrator must sign up again.
- Verified all 46 public application tables have zero rows, `auth.users` has zero rows, and `storage.objects` has zero rows.
- Preserved three Storage bucket definitions and the database structure.
- Updated the first-admin bootstrap instructions for post-reset registration and trusted SQL promotion.
- Bumped the website package version to 2.2.1.

## Validation limits

The live database reset was verified with direct row counts. A full website build/lint/test was not run because dependencies are not installed in this environment; run `npm install`, `npm run lint`, `npm test`, and `npm run build` before production deployment. The Android Evidence app source was not present in this website ZIP and still needs its own Supabase Auth integration.
