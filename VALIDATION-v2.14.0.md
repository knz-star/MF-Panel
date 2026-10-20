# MF MPanel v2.14.0 — Validation Status

## Implemented in source
- Removed the Team Selection page and user-facing workspace switcher.
- Removed frontend calls to `mfp_select_team`; the final SQL migration drops that obsolete RPC if it exists.
- Admin assigns one primary team to standard users. The database profile's `team_key` is the canonical routing/access value.
- Added a pending approval/team assignment page and refresh-access action.
- New profile creation now defaults to `PENDING`; active standard accounts with no team are returned to pending during the migration.
- Team-specific route guards require the assigned primary team, not merely an entry in a legacy module array.
- Kept the Android source unchanged and retained the existing deployed pairing bridge reference.

## Checks completed
- TypeScript/TSX syntax transpilation: 88 files, zero syntax diagnostics.
- Relative import resolution: passed.
- Website RPC source audit: passed.
- Workflow test logic: all included assertions passed when transpiled in a temporary test workspace. Archive library imports were stubbed only because package installation was unavailable; archive parsing itself was not exercised.
- Source smoke assertions for single-team routing, pending approval, RPC-only website calls and migration safeguards: passed.
- ZIP archive integrity: verified after packaging.

## Checks not completed — deployment is NOT approved
- `npm install` timed out in this environment.
- `npm run build` and a real dependency-backed `npm run lint` could not be completed.
- SQL migrations were not executed or parsed against a PostgreSQL test database.
- No live Supabase schema/data was changed, and no Vercel deployment was made from this workspace.

## Required before production
1. Install dependencies in a full Node environment.
2. Run `npm run audit:source`, `npm run test`, `npm run test:acceptance`, `npm run lint`, and `npm run build`.
3. Apply only missing migrations, in order, to a staging Supabase project first.
4. Test Admin + two distinct team users, including direct URL access denial, team assignment, evidence pairing and report sharing.
5. Promote to production only after those checks pass.

## Follow-up QA attempt (2026-10-20)
- Dependency-backed lint was retried with `npm run lint`; it still stops before source checking because the project dependencies are not installed (`TS2688: Cannot find type definition file for 'vite/client'`).
- `npm install --no-audit --no-fund --package-lock-only` timed out; the environment cannot resolve `registry.npmjs.org` (`curl: Could not resolve host`). No dependency lockfile was generated.
- Static migration filename audit found a duplicate version prefix `20261018050000`. Renamed `mfp_evidence_performance_recovery.sql` to `20261018050100_mfp_evidence_performance_recovery.sql` to remove the local version collision. Historical changelog reference was updated.
- The six unapplied migrations still require PostgreSQL execution against an isolated QA database. The linked production database has no existing development branches; production was not modified. Supabase requires a cost confirmation flow before a QA branch can be created, so no branch/database was provisioned in this pass.
