# MF MPanel v2.3.2 — Evidence Pairing UX Fix

- Redesigned Evidence linking panel with a dark glass / violet-blue visual system inspired by the supplied mobile references.
- Pairing code is displayed as six separate digits, preserves leading zeroes, and copy action normalizes to exactly six digits.
- Improved instructions and error messages for expired codes, account mismatch, and Android Supabase-token integration.
- Preserved existing Supabase schema and the secure hashed, single-use pairing flow.

## Important compatibility note
The Android application source was not included in the website ZIP. If Android still reports an invalid code after generating a fresh code, verify the app sends `action: "redeemPairing"`, the exact six-digit `code`, the current Supabase access token in the Authorization header, and uses the same signed-in account that generated the code. Firebase-only authentication is not accepted by this Supabase Edge Function.
