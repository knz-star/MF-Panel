# MF MPanel v2.8.5 — Workspace Separation & Automatic Handoff

## Changes
- Added a workspace switcher based on the current route, so multi-team users can switch directly to Searching, Checking, Reports, or Evidence instead of always seeing the first assigned team as active.
- Admin User Management now reads the canonical `mfp_user_profiles` authorization rows and displays all assigned workspaces. Permission updates write to that canonical table first, because Edge Functions authorize from it.
- Updated `mfp-workflow-control` access checks to use `allowed_modules` rather than only the legacy single `team_key`; a member with Checking assigned can use Checking even if Searching is their first/default team.
- Searching dashboard is now a count-only workspace; no individual URLs or recent profile records are shown to Searching members. Searching-only users cannot open the legacy profile/post/duplicate/manual-handoff pages.
- Removed manual Handoff from Searching navigation. Unique valid links are automatically queued to Checking, or held in the automatic backlog if capacity is full. Duplicate and invalid links go to Admin Review.
- Intake response now includes pasted, profile-link, posted-link, queued, backlog, duplicate and invalid counts; the UI only displays counts, not the URLs.

## Data and safety
- No data reset, destructive migration, Android source change, or Auth-account deletion was performed.
- Searching → Checking → Evidence/Review remains a controlled workflow handoff, not an independent copy of the same data. Workspace navigation and member-facing screens are separated; Admin retains central oversight.
- Production deployment is not claimed. `mfp-team-analytics` and `mfp-workflow-control` were previously missing from the live function inventory; run `bash scripts/deploy-required-functions.sh` from this project after `supabase login`, then verify the remote function list and test with a multi-team account.
- Full build/typecheck is not certified because dependency installation timed out in this environment.
