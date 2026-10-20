# MF MPanel v2.2.2 — Evidence dashboard and pairing fix

- Added compatibility routes `/evidence`, `/evidence/dashboard`, `/dashboard/evidence`, and `/evidence/get-links` so legacy/deep links no longer land on the not-found screen.
- Kept the canonical Evidence linking and Get Links routes intact.
- Pairing code generation now uses cryptographically secure rejection sampling for an unbiased six-digit numeric code, supports leading zeroes, retries a rare unique-code collision, stores only the SHA-256 hash, and retains the ten-minute expiry and one-time redemption flow.
- No service-role key is exposed to the browser.
- Added latest-registration selection in the Evidence status watcher and backend so reconnecting after a revoke does not trigger a multi-row `maybeSingle()` error.
- Fixed React hook ordering in the Evidence linking page and disabled code generation until the user is authorized.
- Improved 404 diagnostics so invalid/expired pairing codes are not confused with a missing Edge Function.
