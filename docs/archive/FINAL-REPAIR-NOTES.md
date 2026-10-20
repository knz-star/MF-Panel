# MF MPanel final backend repair notes (2026-10-17)

## Android app compatibility
- Android application source was not modified.
- Supabase Edge Function `mfp-evidence-linking` deployed as version 9 (`verify_jwt=false`, required for the existing Android flow that sends the public anon/publishable key for `redeemPairing`).
- The `redeemPairing` success path now mirrors an activated registration into `public.mfp_android_app_registrations`, the backing table for the existing Android app's `public.app_registrations` polling view.
- Existing one-time code validation, SHA-256 hash matching, expiry, email matching, authorization, attempt limits and atomic redemption RPC remain in place.

## Live database repairs applied
- Added the missing `public.mfp_user_profiles` table used by the deployed workflow/auth functions and bootstrapped the existing admin account.
- Added the missing `public.mfp_documents` table with RLS, owner/team policies and document-protection triggers.
- Restored Evidence pairing request, attempt-limit, app-registration and connection-event tables.
- Restored the legacy `public.profiles` table used by the signup/auth compatibility flow.
- Added RLS policies for the web dashboard tables and enabled Realtime publication for core MFP workflow/evidence tables.
- Reloaded the PostgREST schema cache.

## Important verification boundary
The Edge Function deployment returned ACTIVE version 9. Database tables/policies were queried after repair. A full Android physical-device redemption, new-account signup, and browser dashboard end-to-end test has not been performed from this environment. Generate a new pairing code for the next test; older codes may have expired or been consumed.
