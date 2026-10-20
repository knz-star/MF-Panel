# MF MPanel v2.3.4 — Website-only Evidence integration rollout

## Scope
- Android project remains unchanged.
- Website adds an admin-only Evidence Operations console.
- SQL adds the compatibility resources expected by the existing Android app.

## Required rollout order
1. Take a Supabase database backup/snapshot first.
2. Open the target Supabase project's SQL Editor and run `MF-MPanel-Evidence-Android-Compatibility.sql`.
3. Review the SQL output for errors. Do not deploy the website if the migration failed.
4. Deploy the updated Edge Function from this project's `supabase/functions/mfp-evidence-linking` directory to the same Supabase project. Example using Supabase CLI from the project root: `supabase functions deploy mfp-evidence-linking --project-ref nvzvyzgantmtwjfnrqdo`.
5. Deploy this website build to the existing hosting target.
6. Sign in as an administrator and open `/admin/evidence-operations`.
7. Test pairing with a new one-time code, then check device registration, import one test batch, capture one test screenshot metadata record, create one export metadata record, and verify all appear in the admin console.
8. Remove test records using an administrator-reviewed cleanup procedure only after confirming they are test data.

## Important compatibility/security notes
- This project ZIP does not mean the SQL or Edge Function has already been applied to the live Supabase project.
- The Android app sends metadata directly with the public key and without a per-user JWT. RLS allows insert-only on metadata tables so the unchanged app can sync, while authenticated admin reads are restricted. Anonymous insert spam remains possible until the app's authentication/request design is updated.
- Android reads `config.value.zip_password` with the public key. The setting therefore cannot be treated as secret. The supplied legacy value is preserved for backward compatibility; anyone able to call the public API may retrieve it.
- The registration compatibility view intentionally exposes only `user_id`, `status`, `team_id`, and `updated_at`, not email/device details.
- Screenshot files and ZIP archives are not uploaded by this metadata sync; only their metadata, hashes and export manifests are tracked.
- Automated build could not be completed in the packaging environment because dependency installation timed out. Run `npm install`, `npm run lint`, `npm test`, and `npm run build` in your build environment before production deployment. Live Supabase and Android round-trip testing is still required.
