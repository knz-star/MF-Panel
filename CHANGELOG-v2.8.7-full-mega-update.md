# v2.8.7 — Full Website Mega Update follow-up

- Added `/admin/health` alias for the existing System Health page.
- Added `mfp-admin-export-settings`, requiring a valid Supabase user session and active ADMIN profile.
- Updated website Export Settings UI to read/write through the admin-only Edge Function instead of directly querying `config`.
- Documented the remaining Android Firestore-to-Supabase migration blocker and public config-read policy.
- No database migration was applied and no production data was changed.

## Not yet verified
- Production deployment and browser acceptance tests are pending.
- Android source changes are not included; the app must be migrated and tested separately.
- Public `mf_config_public_read` policy remains for legacy app compatibility; therefore export-password confidentiality is not fully resolved until Android no longer reads it and the policy is removed in a reviewed migration.
