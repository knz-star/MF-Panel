# v2.3.4 — Evidence Admin Operations & Android Compatibility

- Added an admin-only Evidence Operations screen for batches, screenshot metadata, export manifests, workflow sync events, Android registration status, and export settings.
- Added an additive Supabase migration for the current Android app's direct PostgREST table names and camelCase/snake_case payload fields.
- Added a narrow `app_registrations` compatibility view backed by `mfp_android_app_registrations`; full registration details remain in the existing website registration/event tables.
- Updated `mfp-evidence-linking` to mirror successful pairing and revocation status for the unchanged Android app.
- Added primary-key compatibility triggers to make Android outbox retries more resilient.
- Existing Android source was not modified.
- Validation limitation: dependency installation timed out in this environment, so the production Vite/TypeScript build and live Supabase/Android round-trip test could not be completed here.
