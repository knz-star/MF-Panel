# Changelog

## 2.14.2 — Cleanup + backend fixes (from 2.14.1)

Fixed
- `mfp_web_api` search_path now includes `extensions`. pgcrypto lives in that schema on Supabase, so `createPairing` (`gen_random_bytes`/`digest`) would have failed with "function does not exist".
- Website ZIP export password is no longer returned to the browser (admin read returns only `configured: true/false`).
- New migration `20261020140000_mfp_backend_hardening.sql`: creates `mfp_web_notifications` (used by team-analytics low-score review but never created by any migration), daily cleanup of expired pairing codes, documents RPC-only tables.
- Local browser cache (`localStore`) is wiped on logout so another account on a shared device cannot see earlier records.
- `vercel.json` SPA rewrite added (the old `public/_redirects` was a Netlify file; deep links like `/admin` would 404 on Vercel).
- Console warning when the Supabase env vars are missing and the built-in default project is used.

Removed
- Dead pages: `UserDashboard`, `CheckingQueuePage`, `CheckingVerifiedPage`, `CheckingFailedPage`, `GetEvidenceLinksPage`, `EvidenceAssignmentQueuePage` and their router imports.
- `docs/archive/` (78 historical notes), root SQL file identical to migration `20261017123000`, per-version changelog/validation files, AI-Studio leftovers in `vite.config.ts`/`tsconfig.json`.

Added
- GitHub Actions CI (audit, tests, lint, build), extended `audit:source` checks, `docs/optional-legacy-cleanup.sql` (manual, commented).

Kept on purpose (Android / live-DB compatibility): legacy `config` public-read policy, `app_registrations` view, `mobile-compat/` bridge, all existing migrations unchanged.

## v2.14.3 — session recovery and checking queue compatibility
- Treat the profile-bootstrap RPC as recoverable instead of blocking valid restored Supabase sessions.
- Defer auth-state database hydration until after the Supabase auth callback to reduce auth-lock/deadlock issues.
- Add a profile refresh recovery path and fallback to the legacy profile mirror when canonical profile lookup fails.
- Add gender selection to Profile Settings and persist it to the canonical Supabase profile plus the compatibility mirror.
- Update the link-workflow migration's checker queue selection so eligible stored profile links can be assigned even when their status was not explicitly set to `QUEUED_CHECKING`; terminal and test records remain excluded.
