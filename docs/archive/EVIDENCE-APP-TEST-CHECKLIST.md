# MF Evidence — Supabase end-to-end test checklist

Run after the Android application is migrated to Supabase Auth and the first administrator is bootstrapped.

- [ ] Signed-out caller cannot invoke `mfp-evidence-linking` (401).
- [ ] User without an active Evidence team assignment cannot create or redeem a pairing code (403).
- [ ] Active Evidence user can generate a six-digit code that expires after ten minutes.
- [ ] Pairing code is stored only as a SHA-256 hash.
- [ ] More than three active pending codes is rate-limited.
- [ ] Wrong, expired, cancelled, consumed and already-used codes are rejected.
- [ ] A different Supabase user cannot redeem the code.
- [ ] Concurrent redemption attempts result in one successful registration at most.
- [ ] Successful pairing creates one active `mfp_evidence_app_registrations` row and a `LINKED` event.
- [ ] Realtime website registration status updates after pairing.
- [ ] Get Links requires active registration and active Evidence team authorization on every page request.
- [ ] Get Links returns only `VERIFIED` profiles, paginates correctly, and never exposes failed/blocked/unchecked links.
- [ ] Successful JSON export records a `LINKS_DOWNLOADED` event.
- [ ] User can disconnect their own app; only an administrator can disconnect another user.
- [ ] Revoked users cannot continue protected downloads.
- [ ] Admin connection list rejects non-admin callers.
- [ ] Storage uploads reject non-admins; public read works for the `mfp-assets` bucket.
- [ ] Cross-team workflow reads work; writes are limited by owner/team/admin RLS.
- [ ] Existing MF Links Panel table row counts and functionality remain unchanged.
- [ ] Website `npm run lint`, `npm test`, and `npm run build` pass.

Do not mark production rollout complete until the Android app and website pass these checks.
