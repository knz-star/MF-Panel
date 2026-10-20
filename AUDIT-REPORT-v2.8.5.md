# MF MPanel v2.8.5 — Team Isolation / Handoff Audit

## Confirmed root causes
1. The live Supabase Edge Function inventory was checked on 2026-10-19. `mfp-team-analytics` and `mfp-workflow-control` are absent, while the Evidence functions are active. Frontend calls to the missing functions can therefore continue to fail until both functions are deployed.
2. The workflow function's authorization used a single legacy `team_key` for Searching/Checking access, even when `allowed_modules` granted multiple teams. This made a multi-team member's backend permissions inconsistent with the teams shown at login.
3. The Admin User Management list was sourced from the legacy `users` document collection, while Edge Functions authorize against `mfp_user_profiles`. This could make the admin view show stale or incomplete module assignments.
4. Searching showed a recent profile table with canonical URLs and had a manual Handoff navigation item despite the intended automatic intake flow.

## v2.8.5 changes
- Workspace switcher follows the route the user is actually viewing and is visible on mobile for multi-team members.
- Admin user list reads canonical authorization rows and displays every assigned workspace. Permission updates update `mfp_user_profiles` first.
- Edge Function access checks honor `allowed_modules` for Searching, Checking and Evidence.
- Searching dashboard is count-only; direct access to legacy Searching profile/post/duplicate/manual-handoff pages is admin-restricted.
- Import result shows only counts: pasted, profile links, posted links, auto-sent to Checking, and Admin Review.
- Valid unique records are automatically placed in Checking, or an automatic backlog if queue capacity is full. Duplicate and invalid records are sent to Admin Review.

## Validation
- `npm run audit:source`: PASS; all frontend function invokes have local source.
- `bash -n scripts/*.sh`: PASS.
- Static JSON and targeted assertions: PASS.
- TypeScript parser: 83 TS/TSX files parsed with zero syntax diagnostics.
- Full Vite build/typecheck: NOT CERTIFIED; `npm install` timed out and `vite/client` dependencies are unavailable in this environment.
- Production deployment: NOT DONE. Live inventory confirms the two required functions are still missing.

## Required production step
From the extracted project folder, run `supabase login`, then `bash scripts/deploy-required-functions.sh`. The script audits source, deploys `mfp-team-analytics` and `mfp-workflow-control` to `nvzvyzgantmtwjfnrqdo`, and checks that both appear in the remote function inventory. Then test with an authorized multi-team account. Do not run System Reset during testing; use the preview only.

No Android source, Auth users, legacy MF Links data, evidence files, or workflow rows were modified by this build. No database reset/migration was run.
