# MF MPanel v2.14.1 — Single-Team Assignment and RPC Fix

## What changed

- Website code no longer invokes Supabase Edge Functions. Website actions use authenticated Postgres RPC `mfp_web_api`. Team selection and switching have been removed; Admin assigns one canonical team per standard user.
- `mobile-compat/mfp-evidence-linking` is reference source for the already-deployed Android pairing bridge only. Do not delete the live Android bridge while the existing Android app still redeems pairing codes through it. No Android source has been changed.
- Evidence navigation now opens `/dashboard/evidence-linking`; the old evidence-performance redirect is not used as the Evidence button destination.
- Canonical profile hydration reads `mfp_user_profiles` first, rather than trusting stale legacy user-document team fields.
- On sign-in, users are routed automatically to their single Admin-assigned team. Users cannot select or switch teams; accounts without approval/team assignment see a pending-access page.
- The application shell shows only the Admin-assigned team's work navigation (plus shared reports/profile). Direct access to a different team route is denied.
- RLS for `mfp_documents` removes legacy permissive SELECT/INSERT/UPDATE/DELETE policies before installing the team-scoped rules (Postgres OR-combines permissive policies). Admin retains global access; members see assigned checking profiles, team-scoped records, own permitted non-workflow documents, and reports explicitly shared with their team/gender group. Checking users can update only assigned source profiles that remain scoped to the Searching team. The separate public landing-assets policy is preserved.
- Export settings entered on the website are stored in a private table; this website-only setting does not change the unchanged Android app's legacy export configuration.

## Apply missing migrations in order

The live Supabase migration inventory checked on 2026-10-20 ended at `20261018151434`; the following project migrations were not present in that inventory. In Supabase SQL Editor, apply the contents of these files one at a time in this order, unless your migration inventory now confirms a file is already applied:

1. `supabase/migrations/20261020093000_mfp_assign_links_zip_receipts_private_checking.sql`
2. `supabase/migrations/20261020120000_mfp_gender_profile_post_ids.sql`
3. `supabase/migrations/20261020123000_mfp_organization_reports_sharing.sql`
4. `supabase/migrations/20261020124500_mfp_reports_team_admins.sql`
5. `supabase/migrations/20261020125500_mfp_gender_team_admins.sql`
6. `supabase/migrations/20261020133000_mfp_web_rpc_replacements.sql`

Do not apply a migration twice if your live migration inventory already shows its version. Review the current live schema before applying migrations; this package has not been executed against production. The final migration explicitly drops the obsolete `mfp_select_team(text)` RPC so users cannot switch their assigned team through that endpoint.

## Website deployment

1. Extract this ZIP and connect its repository/build to the existing Vercel project.
2. Keep the existing Supabase project URL and publishable/anon key as currently configured. Never add the `service_role` key to frontend environment variables.
3. Run `npm install`, then `npm run audit:source`, `npm run test`, `npm run lint`, and `npm run build` in a full Node environment.
4. Deploy to a Vercel preview first. Verify login, Evidence pairing code creation, automatic assigned-team routing, cross-team URL access denial, assigned link export, checking actions, organization report sharing, and Admin bulk delete using at least two different team accounts plus the Admin account.
5. Promote to production only after those checks pass.

## Verification status for this package workspace

- TypeScript/TSX syntax transpilation: 88 source files, zero syntax diagnostics.
- Relative import resolution scan: passed.
- Website source audit: passed; no `supabase.functions.invoke`, `httpsCallable`, or `/functions/v1/` calls in website source.
- Shell syntax checks: passed.
- Full Vite build and dependency-backed tests: **not verified** because dependency installation timed out in this environment.
- SQL migration execution and Vercel deployment: **not performed**. This ZIP is a source fix package, not a claim that the live website is already fixed.
