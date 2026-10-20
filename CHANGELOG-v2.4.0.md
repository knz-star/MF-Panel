# MF MPanel v2.4.0 — Backend recovery and landing cleanup

- Removed the Supabase project reference from the public landing page and footer.
- Corrected landing copy to reflect the existing MF Evidence app.
- Added Google Fonts Inter and Noto Nastaliq Urdu support.
- Restored the missing Evidence performance analytics tables through an additive Supabase migration.
- Existing data was not deleted. No Android application source was modified.

## Deployment note
Deploy the included `mfp-evidence-performance` Edge Function and apply `supabase/migrations/20261018050000_mfp_evidence_performance_recovery.sql`. Analytics only reports activity that has actually been synced; it does not fabricate historic screenshots or app-local files.
