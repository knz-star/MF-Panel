# MF MPanel v2.8.9 — Health fallback correction

- System Health no longer repeatedly invokes the three known-missing optional endpoints.
- Team analytics, workflow control, and secure export settings now report `FALLBACK` with clear capability limits instead of generic red request errors.
- Existing live evidence performance and evidence linking checks still run normally.
- Team Analytics recognizes the generic request failure as an unavailable endpoint and displays the cookie-based browser-usage fallback.
- No insecure client-side replacement was added for protected team scores, workflow ingestion/reset, or export passwords.
- This is a source package update only. Deploy the website to apply it; it does not deploy Supabase Edge Functions or fix server-side features that require those functions.
