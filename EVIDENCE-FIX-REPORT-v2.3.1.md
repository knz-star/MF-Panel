# MF MPanel v2.3.1 — Evidence Dashboard Fix Report

## Included
- Evidence App status and performance dashboard integration.
- Assigned, completed, pending, and returned link counts grouped by platform.
- Daily, weekly, monthly, and 90-day score/activity analysis.
- Score formula: completed outcomes / (completed + failed outcomes), with untouched pending links excluded.
- If the rolling 30-day score is below 25% after at least one completed/failed outcome, non-admin users have assigned/pending/completed work returned to the shared pool, activity history retained, Evidence registration revoked, and global sessions invalidated.
- `knzbro602@gmail.com` is configured as ADMIN with all module permissions; exact-email bootstrap only promotes this account after email confirmation.

## Important Android integration note
The website backend can only score work that the Android application syncs through `syncWorkActivity` to `mfp-evidence-performance`. The Android app must send `ASSIGNED`, `OPENED`, `PENDING`, `COMPLETED`, and `FAILED` events and honor an `autoRevoked: true` response by clearing its local session/UI. Outstanding pairing requests are cancelled as part of revocation. The Android source project is not included in this website ZIP.

## Database safety
The migration is additive and preserves existing evidence activity. It does not run the separate permissive `public.app_registrations` / `public.pairing_codes` SQL schema.
