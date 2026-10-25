## v2.16.2 — Authentication fixes
- Hardened password recovery callback handling for Supabase PKCE/session timing, rejects direct visits without a recovery link, and gives a clear expired-link path.
- Removed Continue with Google from the login UI and auth context because provider enablement/credentials cannot be verified/configured from this project package; avoids advertising a broken login method.

# Changelog

## 2.16.1 — Live dashboard and tracker fix
- Corrected dashboard totals to use database-side counts rather than loaded-page length. Added per-user Searching counts for today, 7 days and all time, including members with zero intake.
- Added operational daily metrics for Searching, Checking and Evidence; Report Generator is not counted as a separate completed team, and Reports Team Admins see Evidence ZIP metrics. ZIP analyzer receipts count as analyzed links.
- Added full-database Global Tracker lookup and public exact-URL/ID tracking at `/track`.
- Added recorded link status timeline capture and a team-scoped WhatsApp settings panel.
- Added a standalone secure Searching intake RPC with normalized duplicate detection and profile/post classification.
- Applied landing-page visual tokens across the authenticated application shell.
- Removed the newer migration that reissued the complete `mfp_web_api` dispatcher; production-only actions must remain untouched.
- Full npm build/test suite is pending because package installation was blocked by unavailable npm registry access.
