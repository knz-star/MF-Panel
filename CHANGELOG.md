# Changelog

## v2.16.4 — 2026-10-25
- Simplified Searching intake to one focused paste box with live profile/post/unknown detection preview.
- Improved URL classification for Facebook post/story/photo links and additional Instagram/YouTube patterns.
- Added clearer Checking instructions that display the exact URL and tell the checker to verify profile versus individual post/video.
- Added an optional one-time admin-entered password for encrypted incoming ZIP analysis; it is not saved in the report snapshot. The five managed Supabase codes remain supported.
- Added URL classification regression tests.
- Gender/team isolation still requires the companion database migration and end-to-end authorization verification; this package does not claim that security boundary is fully deployed.

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

## v2.16.3 — Authentication adjustments
- Removed signup/login email-confirmation resend UI; account access remains gated by MF MPanel admin approval and team assignment.
- Added a database-backed quota for the website password-reset flow: two reset-email requests per email per rolling seven days.
- Login and signup banner images now fall back to a bundled local asset if an external image URL fails.
- Continue with Google remains removed from the login screen.
- Supabase hosted Email confirmation must be switched OFF in Authentication settings; a ZIP or SQL migration cannot change that hosted Auth setting.
