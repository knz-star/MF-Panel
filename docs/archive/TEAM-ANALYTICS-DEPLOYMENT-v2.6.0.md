# Team Analytics — deployment and validation notes

This is a **working-copy feature**. The production Supabase project has not been changed by this edit.

## Files added
- `src/features/admin/AdminTeamAnalyticsPage.tsx`
- `src/services/teamAnalyticsService.ts`
- `supabase/functions/mfp-team-analytics/index.ts`
- `supabase/migrations/20261018070000_mfp_team_analytics_admins.sql`

## Role model
- `ADMIN`: senior/global administrator. Can assign team leads and see all three teams.
- `TEAM_ADMIN`: restricted team administrator. Server-side analytics/review access is limited to the team assignment; app navigation is limited to Team Analytics and Profile.
- Team leads must already have an active `ADMIN` or `TEAM_ADMIN` profile before they can be assigned. Promote a candidate through the existing Admin Users page first.

## Score model
- Score = completed outcomes / (completed + failed outcomes) × 100.
- Work volume by itself is not treated as quality. If events cannot be attributed to a user or do not contain recognizable outcome values, the UI shows “Not enough data”.
- Scores are evaluated when the member opens their score/profile view or an administrator refreshes Team Analytics. A qualifying score below 25% creates a warning, disables the account in the app profile records, and notifies administrators. This working version does **not** configure a scheduled background evaluator, so it does not promise enforcement while nobody is opening the app/dashboard.
- “Keep active” restores the account after review. “Remove member” keeps the account disabled and clears its team access. Existing work/history rows are retained.
- Three consecutive days of declining team score produce one trend alert per team per UTC day.

## Deployment gate
1. Review `20261018070000_mfp_team_analytics_admins.sql` against the target database and back up schema/data first.
2. Apply the migration only after explicit approval; it adds role `TEAM_ADMIN` and three metadata tables with RLS enabled and no client policies.
3. Deploy `mfp-team-analytics` as an Edge Function. It uses the platform's `SUPABASE_URL`, anon/publishable key, and server-side `SUPABASE_SERVICE_ROLE_KEY`; never put the service-role key in browser code.
4. Build/deploy the website and test with a senior admin, one team admin, one regular member, a score with no outcomes, a score above 25%, a score below 25%, and cross-team access denial.
5. Confirm no Android source changes are needed. Android source was not modified here.

## Test status
- TypeScript/TSX syntax transpilation passed for all 78 source/function files.
- A full `tsc` type check, production Vite build, browser tests, and live function/migration tests were not completed because package dependencies could not be installed in the environment.
- The migration and function are not deployed to production.
