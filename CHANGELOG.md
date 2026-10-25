# Changelog

## 2.16.0 — Admin pledge downloads fixed, Admin Dashboard team-work view, Searching post-link tracking
- Pledge: Admin can now download EVERY user's signed pledge. Root cause chain fixed on both sides — the Admin list row could be stale and hide a submitted pledge (buttons stayed disabled), and the backend user-list/pledge functions are re-issued in the new backend fix file. The PDF service now re-resolves the freshest profile before generating, per-user buttons are no longer blocked by stale row data, and a new **Download ALL Pledges (PDF)** button on Admin → Users exports one PDF with one page per user. The long-standing pledgePdfService TS2322 lint error is also fixed — lint is fully clean now.
- Admin Dashboard: new **Team Work** panel — Searching / Checking / Reports / Evidence work split by Male Team and Female Team with total numbers, plus Total Work / Completed / Failed / Active Members. Period switch: **Daily / 7 Days / All**, computed from the team-analytics daily series and member totals.
- Admin Dashboard shortcuts: every admin page now has a button — added Link Management, Team Analytics, Male & Female Teams, Checking Results, Evidence Connections, Evidence Operations and System Health cards (previously only reachable from menus).
- Searching intake: post links are now tracked as POSTS, not profiles. The website already classified each pasted URL (profile vs post) but never sent the type, and the backend ingest stored every link as a profile. Frontend now sends the link type; the backend fix file re-issues the ingest action with server-side classification, real duplicate detection (database + same batch) and invalid counting, correct 'posts' storage, and separate profile/post counts in the result.
- Backend: NEW migration `20261025120000_backend_fixes_pledge_and_ingest.sql` — also delivered to the owner as a standalone file `MF-MPanel-BACKEND-FIX-v2.16.0.sql` to run once in the Supabase SQL Editor (idempotent). It contains: mfp_save_pledge + mfp_admin_list_users (with preferences) re-issue, and the full mfp_web_api re-issue with only the ingestLinks action changed.


## 2.15.0 — Professional UI refresh, gender-separated teams, WhatsApp Support
- UI: fully redesigned professional landing page (new hero, features, how-it-works, stats, FAQ, footer) on one consistent modern design system; the old landing design is removed. Existing landing data hooks and routes are unchanged.
- Crash fix: the Male/Female Team Dashboard could crash/loop because its data refresh callback re-created itself whenever it updated the selected group state, and dashboard rendering assumed API data was always present. Refresh now takes the group as a parameter (no state loop), rendering is null-safe with empty states, and the gender-teams route is wrapped in an error boundary with a friendly fallback.
- Teams: Male and Female teams are fully separated — the admin assignment dropdown for each group lists only admins of the matching gender (gender_group, then gender) and a mismatched assignment is refused; each group keeps its own lead and its own per-group dashboard view; group leads only see their own group.
- WhatsApp Support: each gender group's Team Admin (or Main Admin) can set/update a WhatsApp support number and label from the group dashboard ("WhatsApp Support" card). Members of that group see a WhatsApp Support button on their Checking, Searching, Reports and Evidence dashboards that opens wa.me/<number>. No number set = no button; groups never see each other's number.
- Pledge: unchanged — Main Admin per-user signed pledge PDF download works as before.
- No database migration required (support contacts use the existing settings document store: settings/support-male, settings/support-female).

## 2.14.16 — Faster Link Management deletion
- Replaced one-request-per-link deletion with batched Supabase deletes (up to 200 IDs per request) and bounded parallel processing.
- Verifies deletion in batches and preserves IDs of records that remain or cannot be verified.
- Updates the visible list locally after verification instead of reloading every profile and post after deletion.
- No Android app changes and no database schema migration required.

# Changelog

## 2.14.10
- Pairing: website codes are mirrored into legacy `pairing_codes` (new RPC `mfp_sync_legacy_pairing_code`, applied to production) so the installed Android app no longer says "invalid". If the mirror fails the request is cancelled and the user sees an error instead of a dead code.
- Auth: existing-email signup no longer claims an email was sent (neutral, non-enumerating message + resend button); login/signup/forgot use one Roman-Urdu error mapper (`src/utils/authErrors.ts`) with a support ref for unexpected errors.
- Auth: new `/reset-password` page (expired/used link handling, new password form); reset email now redirects there instead of `/login`.
- NOT build-verified: sandbox had no npm registry access.

## 2.14.9
- Organization/team and gender-group reports now download as premium A4 PDF (was JSON).
- Pledge PDF redesigned: framed A4 layout, header band, reference ID, declarant card, signature blocks.
- New shared renderer: src/utils/pdfReport.ts (Urdu-safe canvas pages embedded via pdf-lib).
- NOT build-verified: sandbox had no npm registry access.


## 2.14.8
- Live backend: member Activity Score uses actual work in the rolling 24-hour window (10 points per submitted/checked/completed link, capped at 100).
- Live team analytics RPC restricts non-senior admins to their own gender group within their assigned functional team. Senior ADMIN remains organization-wide.
- Added reproducible migrations `20261021062000_mfp_gender_scoped_activity_score.sql` and `20261021062500_mfp_activity_score_team_rollup.sql`; both applied to live Supabase. Team and admin rollups now use activity volume too.
- Team trend chart remains outcome-quality based; member Activity Score is the rolling 24-hour volume score.
- Per-team Male/Female admin assignment UI and end-to-end gender isolation across every workflow endpoint still need completion/testing.

## 2.14.7
- Added dedicated Global Tracker search for URL, public/internal IDs, parent profile references, and recorded workflow roadmap.
- Added Global Tracker to the senior administrator navigation.
- Simplified Team Admin navigation to their assigned functional team; removed cross-team Shared Reports and unrelated gender dashboard links from the Team Admin menu.
- No Android app source changes.

## v2.14.5 — Report picker, team navigation, admin selection and pledge settings

- Stabilized Supabase profile hydration after browser/file-picker resumes; existing canonical profiles are loaded even if the profile-ensure RPC has a transient error.
- Hardened ZIP/JSON file selection, cancellation and re-selection behavior.
- Evidence team bottom navigation now contains only Assign Links and Evidence Pairing, in that order.
- Searching workspace opens directly to Paste Links as its only team page.
- Active admin options are loaded from canonical profiles for team and gender lead selectors.
- Simplified the pledge settings to allow the full Urdu text, organization name and official signature label to be configured in Site Assets.

## 2.14.4
- Fix persistent team assignments with a single secure Supabase admin RPC.
- Stop legacy user-document writes from overwriting canonical access profiles during login/logout.
- Keep canonical profile and compatibility user document synchronized atomically.


## 2.14.3 — Pledge PDF, signup review, and team analytics fixes

Fixed
- Pledge submission now uses the authenticated `mfp_save_pledge` RPC instead of directly updating a legacy document row.
- Pledge copy downloads as a PDF with the user's typed signature and a separate official-signature area. The active “Official pledge signature” image is managed from Admin → Site Assets.
- Signup creates a canonical `PENDING` profile in the database, and legacy missing profile rows are safely backfilled as pending rather than granted access.
- Admin Users uses a protected server-side RPC to list canonical users, including pending accounts.
- Team analytics reads live server-calculated scores from `mfp_team_analytics_data`; the senior admin is excluded from selectable team-lead options.
- Admin gender-group views include pending/disabled members for review; non-admin group leads remain scoped to active members.

Validation
- Changed TypeScript/TSX files passed TypeScript parser syntax checks. A full dependency-backed build could not run in this environment because package installation did not complete.

## 2.14.2 — Cleanup + backend fixes (from 2.14.1)

Fixed
- `mfp_web_api` search_path now includes `extensions`. pgcrypto lives in that schema on Supabase, so `createPairing` (`gen_random_bytes`/`digest`) would have failed with "function does not exist".
- Website ZIP export password is no longer returned to the browser (admin read returns only `configured: true/false`).
- New migration `20261020140000_mfp_backend_hardening.sql`: creates `mfp_web_notifications` (used by team-analytics low-score review but never created by any migration), daily cleanup of expired pairing codes, documents RPC-only tables.
- Local browser cache (`localStore`) is wiped on logout so another account on a shared device cannot see earlier records.
- `vercel.json` SPA rewrite added (the old `public/_redirects` was a Netlify file; deep links like `/admin` would 404 on Vercel).
- Console warning when the Supabase env vars are missing and the built-in default project is used.

Removed
- Dead pages: `UserDashboard`, `CheckingQueuePage`, `CheckingVerifiedPage`, `CheckingFailedPage`, `GetEvidenceLinksPage`, `EvidenceAssignmentQueuePage` and their router imports.
- `docs/archive/` (78 historical notes), root SQL file identical to migration `20261017123000`, per-version changelog/validation files, AI-Studio leftovers in `vite.config.ts`/`tsconfig.json`.

Added
- GitHub Actions CI (audit, tests, lint, build), extended `audit:source` checks, `docs/optional-legacy-cleanup.sql` (manual, commented).

Kept on purpose (Android / live-DB compatibility): legacy `config` public-read policy, `app_registrations` view, `mobile-compat/` bridge, all existing migrations unchanged.

### Applied to the live Supabase project (2026-10-21)
Migrations 1–7 are live. Extra fixes made while applying: `mfp_ensure_profile` now keeps gender/gender_group; migrations 3 and 5 no longer install a temporary policy that exposed profiles/posts to every signed-in user; `mfp_normalize_link_url` has a fixed search_path.


## v2.14.6 — PDF Designer, Resume Stability & Team Admin UX
- Added a live A4 pledge preview in Site Assets with organization/team name, signature label, font size, line spacing, and margin controls.
- Persisted pledge layout settings and applied them to the generated one-page pledge PDF, with dynamic text wrapping and font reduction to fit the available body area.
- Added a two-minute warm-profile cooldown after successful profile hydration to prevent repeated profile/RPC checks when mobile file pickers suspend and resume the browser. This does not bypass Supabase Auth or change server-side authorization.
- Enabled promotion to TEAM_ADMIN from User Management and clarified the follow-up team-lead assignment flow. Team Analytics now shows the current senior admin as a disabled option with an explanation rather than silently hiding all admin choices.

## 2.14.12 — Admin pledge export and reliability fixes
- Added per-user admin download for submitted signed pledge PDFs from the User & Role Management table and user detail panel.
- Fixed a data-mapping bug: the admin user-list RPC already returned canonical `preferences`, but the frontend discarded pledge acceptance/signature/timestamp fields. Freshly submitted pledges now appear as submitted and become downloadable.
- Pledge PDF generation uses the saved signature and submission timestamp, carries the user ID/email for attribution, and falls back to the standard pledge text if document settings are unavailable.
- Improved admin user-list loading failures with a visible actionable message instead of failing silently.
- Versioned the package as 2.14.12. Production build/browser performance verification is still required after dependency installation and deployment.


## 2.14.14 — Multi-admin teams and inactivity score decay

- Team Analytics now supports assigning multiple active Team Admins to the same team; each Team Admin remains scoped to one team, and the senior admin cannot self-assign.
- Analytics now returns assigned admin IDs and displays all assigned admin names plus their average activity score.
- Activity score uses real workflow actions in a rolling 30-day window, capped at 100 points, with a 25% reduction after 3 inactive days and a 50% reduction after 7 inactive days. Scores refresh through the existing dashboard polling; this does not change Android app source.
- Live Supabase migrations `mfp_multi_team_admins_and_inactivity_score_decay` and `mfp_require_multi_admin_assignment_payload` applied successfully. Frontend build/browser verification and website deployment are still pending.


## 2.14.15 — Checking Team UX and Admin Link Exports
- Reworked Checking dashboard and single-link review screen for mobile: open first, then choose Re-open, Verified, Invalid, or Blocked.
- Verified requires exactly three URLs in a dedicated modal; Invalid uses a required note modal; Blocked offers PTA/Platform choices and stores the choice as a generated note.
- Admin Link Management now shows workflow status and downloads Invalid and Blocked links separately as text files.
- Android app source unchanged. Production build and deployment remain unverified because npm install timed out.

## 2.14.17
- Added visible Admin Dashboard shortcuts for System Tests and System Test Reset / Workflow Review & Reset.
- Removed System Tests from the mobile More menu so the dashboard is the primary shortcut location.


## 2.14.18 — Five ZIP Codes, Match Traceability, and Large Link Management
- Replaced the single website ZIP password with exactly five administrator-managed code slots stored in the private Supabase schema. Active senior Admins can generate five codes on Supabase or enter custom codes; all five must be unique and saved before analysis.
- ZIP analysis tests the five configured codes in order, stops at the first code that opens and validates the archive, and shows/saves the ZIP filename plus matching slot label. Password values are not written into report snapshots.
- Link Management now fetches and renders only a paginated slice of records instead of loading and mounting the full 19k+ dataset at once. Search is server-filtered, deletion remains batch-based, and Invalid/Blocked exports scan all pages when explicitly requested.
- Applied Supabase migrations for the five-code RPCs, tightened the legacy single-code RPC to senior Admins, and added a composite index for Link Management pagination. The matching SQL files are included in the ZIP. Android source remains unchanged. Production build and deployment are not yet verified.
