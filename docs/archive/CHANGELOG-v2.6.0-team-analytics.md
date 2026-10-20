# MF MPanel v2.6.0 — Team Analytics (working build)

## Added
- `/admin/analytics` with 7-day / 14-day views, team-specific colors, daily score trend graph, activity bars per member, team totals and member scores.
- Senior administrator can assign one active administrator to each of Searching, Checking and Evidence. Assigned users become the restricted `TEAM_ADMIN` role; they see only Team Analytics and Profile in the admin navigation and are scoped server-side to their assigned team.
- Team-admin assignments, low-score review queue and team trend alert metadata are defined in a new SQL migration.
- Profile page shows each user's own score/status, completed/failed counts, 7/14-day daily activity and account status. No profile photos are displayed.
- Score formula: completed outcomes / (completed + failed outcomes) × 100. Missing outcome data displays “Not enough data”; activity volume alone is not converted into a score.
- A verified score below 25% can disable the account and create an admin warning. A manager can keep the account active after review or remove team access while leaving it disabled. Historical records are retained.
- Three consecutive daily score declines create a team trend warning and an admin notification. Analytics refreshes every 30 seconds while open.

## Compatibility and safety
- No Android application source was changed.
- No live Supabase schema, RLS policy, user account, or production record was changed while preparing this working build.
- The migration and `mfp-team-analytics` Edge Function must be deployed together before this feature can work against Supabase.
- Score calculations depend on correctly attributed workflow events/outcomes. When existing records do not identify the actor or contain outcome types, the dashboard intentionally reports insufficient data rather than fabricating a score.
- Current score enforcement runs when the user's score endpoint or admin analytics endpoint evaluates the available data. A separate scheduled background evaluator is not configured in this working build; continuous enforcement while nobody opens the app requires a secured Supabase scheduled invocation.
- The complete production build/browser test could not be run in this environment because dependencies were not available. TypeScript/TSX syntax transpilation passed for all source and Edge Function files.
