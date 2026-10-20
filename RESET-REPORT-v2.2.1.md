# MF MPanel v2.2.1 — Supabase reset report

**Target project:** `nvzvyzgantmtwjfnrqdo` (`eu-west-3`)  
**Reset date:** 2026-10-16  
**Scope:** Full application-data and Auth-user reset; schema/configuration retained.

## Actions completed

- Truncated all 46 base tables in the `public` schema with identity sequences restarted and FK dependencies handled by PostgreSQL cascade.
- Deleted all rows from `auth.users`; dependent identity/session/refresh-token records were handled by foreign-key cascades.
- Kept table definitions, database schemas, constraints, RLS policies, functions, migrations, and deployed Edge Functions in place.
- Did not drop or recreate the Supabase project.

## Post-reset verification

- All 46 `public` application tables: **0 rows each**. This includes legacy MF Links workflow tables, `platforms`, old user profiles, news/AI/connector data, and all `mfp_*` data tables.
- `auth.users`: **0 rows**. Existing login accounts, including the former administrator, no longer exist.
- `storage.objects`: **0 rows**.
- `storage.buckets`: **3 bucket definitions preserved**.
- `mfp-evidence-linking` and other deployed Edge Functions were not removed.

## Required after reset

1. Register the intended admin account again through MF MPanel.
2. Sign in once so the `mfp_user_profiles` row is created.
3. Follow `SUPABASE_ADMIN_BOOTSTRAP.md` to promote the account through the trusted SQL Editor.
4. Add back platform catalog rows, AI provider settings/secrets, RSS sources, connector settings, and other app configuration only when needed. These application rows were intentionally cleared.
5. Run `npm install`, `npm run lint`, `npm test`, and `npm run build` before deploying.
6. The Android Evidence app must still be updated separately to use Supabase Auth; its source was not included in this website ZIP.

## Not changed

This operation did not drop schemas/tables, alter RLS policies, rotate API keys, delete Storage bucket definitions, remove Edge Functions, or change Supabase project-level Auth/URL configuration.
