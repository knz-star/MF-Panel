# v2.3.3 — Android Pairing Fix

- Added dedicated server-side `redeemPairing` flow for email + six-digit code without requiring an existing Android session.
- Kept all management actions behind JWT validation inside the Edge Function.
- Added per-email failed-attempt throttling (10 attempts / 15 minutes) using a service-role-only table and RPC.
- Added additive migration `20261017061000_evidence_pairing_rate_limit.sql`.
- Kept website code generation, SHA-256 storage, ten-minute expiry, and atomic one-time redemption.
