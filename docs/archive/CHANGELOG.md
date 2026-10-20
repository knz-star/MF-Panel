# Changelog

## v2.3.1 — Evidence performance policy and admin access
- Enforce the under-25% rolling 30-day score policy as soon as at least one completed/failed outcome is available.
- Return assigned, pending, and completed Evidence work to the shared pool, preserve event history, revoke Evidence registration, and invalidate global sessions.
- Ensure the verified `knzbro602@gmail.com` account receives ADMIN role and all admin module permissions.
- Keep daily, weekly, monthly, and 90-day analytics with platform breakdowns.

# v2.2.1 — Fresh reset baseline and bootstrap update

- Full application data/Auth reset verified on the target Supabase project; schema and deployed functions preserved.
- Updated post-reset first-admin bootstrap documentation and package version.

# Changelog — MF MPanel v1.4.0

- Removed team selection from signup; unassigned users choose a workspace after signup/login.
- Added `/select-team` with Searching, Checking, and Report Generator options.
- Added `teamConfirmed` profile state and single-team module gating.
- Updated Firestore user rules to allow safe post-login team assignment without permitting self-assigned admin roles.
- Fixed signup/login hydration duplication and the profile-write race with the Auth `onCreate` Cloud Function.
- Updated the Cloud Function to preserve existing profiles and team selections.
- Added password visibility controls on login, signup, and confirm-password fields.
- Improved duplicate-email and Firestore permission error messages.
- Added trusted Admin SDK bootstrap for `knzbro702@gmail.com` using custom claims; no password or service-account key is stored in source.


## v1.4.1
- Added `knzbro702@gmail.com` to the Firestore admin check, gated by Firebase's `email_verified == true` claim.
- Kept the trusted Admin SDK custom claim as the preferred admin mechanism.

## v1.4.2 — Team-selection Firestore permission fix

- Fixed Firestore `users/{uid}` create rules to allow both an unassigned account profile and the explicitly selected team profile when a profile document does not yet exist.
- Kept one-time team assignment restricted to the signed-in profile owner and the three allowed teams.
- Made the update condition tolerant of older user documents that do not yet have `accountStatus`, while preventing role/account-status changes during team selection.
- Fixed both landing-asset URL regex expressions that were rejected by Firebase Rules; URL scheme and length are checked separately.
- Improved the team-selection permission error to identify the `users/{uid}` write and explain which rule cases must be published.


## v1.4.3 — Team assignment rules compatibility
- Expanded one-time team assignment to support legacy unassigned USER/SEARCHER/CHECKER profiles without granting admin privileges.
- Rules permit both selected-team profile creation and one-time update of an unassigned profile.
- Updated permission-denied UI message to distinguish a rejected request from rules not being published.

## v2.3.1 — Evidence Performance Dashboard

- Added Evidence Performance dashboard routes for team members and administrators.
- Added daily, weekly, monthly and 90-day views for assigned/completed/pending counts, platform breakdown, activity trends and score rate.
- Added protected `mfp-evidence-performance` Edge Function and server-only activity tables.
- Added automatic return-to-pool and Evidence access revocation for qualifying scores below 25; immutable activity history is retained.
- Promoted `knzbro602@gmail.com` to ACTIVE ADMIN in the live MF MPanel profile and added a verified-email bootstrap rule for future profile creation.
- Android per-link event sync is required for live completed/pending metrics; see `EVIDENCE-PERFORMANCE-AND-ANDROID-SYNC-v2.3.1.md`.

## v2.6.0 — Team Analytics (working build)
- Added team analytics for Searching, Checking and Evidence with 7/14-day views, colored score trends and member activity.
- Added restricted TEAM_ADMIN role, senior-admin team lead assignment, low-score review queue and team trend warnings.
- Added personal performance score/status on Profile; no profile images are shown.
- Added migration and `mfp-team-analytics` Edge Function source. Not deployed to production.

## v2.7.0 — Automatic Workflow & Safe Reset (source build)
- Searching paste-only automatic intake; clean unique links go directly to Checking.
- Duplicate/invalid and Checking blocked outcomes route to Admin Review.
- Verified Checking results create Evidence assignment queue items.
- Senior-admin review/reset page with test-only cleanup and separate workflow reset.
- Added secure score scheduler function for background <25% enforcement; requires configured cron invocation.
- No Android source modifications and no live Supabase changes performed.


## v2.8.0 — Verified additive backend update (2026-10-18)
- Applied and verified `mfp_team_admin_assignments`, `mfp_team_score_warnings`, and `mfp_team_trend_alerts` on the live Supabase project.
- Applied and verified workflow indexes plus the `mfp_documents_guard_test_data_flag` trigger.
- No rows were deleted; Auth users, existing MF Links data, app registration data and Storage objects were not reset.
- Added a live backend status report. Edge Function deployment and production build are explicitly not claimed as complete.
