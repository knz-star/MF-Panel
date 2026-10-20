# v2.8.2 — Team Analytics warning-only safety fix

- Removed automatic account disabling from low-score handling in `mfp-team-analytics`.
- Low scores now create a review warning and notify admins while leaving account access unchanged.
- Manual administrator review actions remain explicit and unchanged.
- No migration rerun and no Android source changes.
- Live Supabase deployment must be performed and verified separately.
