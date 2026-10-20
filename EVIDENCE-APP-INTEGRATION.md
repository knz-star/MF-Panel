# MF Evidence ↔ MF MPanel — Supabase integration contract

## Website/backend
- Website route: `/dashboard/evidence-linking`
- Protected JSON export route: `/dashboard/get-links`
- Supabase project ref: `nvzvyzgantmtwjfnrqdo`
- Edge Function: `mfp-evidence-linking` (JWT verification enabled)
- Evidence access requires an active account and an assigned Evidence team (or administrator role).
- Pairing codes are 6 digits, expire after 10 minutes, are stored as SHA-256 hashes, and are single-use. Three unexpired pending requests per user is the maximum.
- Registration and connection events are stored in `mfp_evidence_app_registrations` and `mfp_evidence_connection_events`.

## Android app requirements
The Android source was not included in the website ZIP. The Android app must be migrated from Firebase Auth to Supabase Auth before this integration can work. It must sign in to the same Supabase project/account as the website. A Firebase ID token is not a valid Supabase JWT.

Call the Edge Function endpoint `https://nvzvyzgantmtwjfnrqdo.supabase.co/functions/v1/mfp-evidence-linking` using the user's current Supabase access token in `Authorization: Bearer <access_token>` and the publishable key in the `apikey` header. Use JSON bodies:

1. `{"action":"redeemPairing","code":"123456","deviceLabel":"Android device"}`
   - Same signed-in account that generated the code is required.
   - The backend validates the code, team access, expiry, and one-time use atomically.
2. `{"action":"getSummary"}`
   - Rechecks current account/team authorization and active registration.
3. `{"action":"getLinksPage","cursor":null}`
   - Returns at most 100 verified profile links and `nextCursor`; repeat until `nextCursor` is null.
4. `{"action":"recordDownload","count":100,"platforms":{"INSTAGRAM":100}}`
   - Call only after a successful export.
5. `{"action":"disconnect"}`
   - Revokes the current user's app registration. A new code is required to relink.

Do not store pairing codes long-term. Clear the code from memory after success/failure. Never treat a device label or locally cached status as proof of authorization. Stop protected operations if the backend returns 401/403. A successful website code generation does not by itself prove the Android app is linked; wait for a successful `redeemPairing` response and the realtime registration update.

## Current status
The website Edge Function is deployed and database tables exist. Android-side migration and end-to-end live pairing tests remain outstanding because the Android project was not included in this ZIP.


## Website-only Android compatibility update (v2.3.4)
- Admin route: `/admin/evidence-operations` (administrator only).
- New/compatible resources: `app_registrations` view, `mfp_android_app_registrations` private backing table, `config`, `evidence_batches`, `evidence_screenshots`, `evidence_exports`, and `evidence_workflow_events`.
- The existing Android app source is not changed. Pairing success/revocation mirrors the legacy status the app polls.
- Run `MF-MPanel-Evidence-Android-Compatibility.sql` in the target Supabase SQL Editor, then deploy the updated `mfp-evidence-linking` Edge Function source from `supabase/functions/mfp-evidence-linking`. Deploy the updated website after that.
- The Android app sends direct metadata inserts using the public key and no per-user JWT for those inserts. RLS is insert-only for those metadata tables and admin-read for the website, but unauthenticated inserts can still be spammed. Strong per-device write authentication cannot be guaranteed without changing the app's request/auth design.
- The Android app reads `config.value.zip_password` through the public key. That setting is consequently readable by clients that can call the public API; it must not be treated as a secret. This limitation is retained for backward compatibility and would require an app change to remove.
- Evidence files/screenshots remain local to the device; this sync stores metadata and hashes, not screenshot bytes or ZIP files.
