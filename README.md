# MF MPanel 2.14.2

A single frontend + backend setup:

- **Frontend:** Vite + React + TypeScript, deployed on the existing Vercel project.
- **Backend:** Supabase Auth, PostgreSQL/RPC, RLS, Storage and Realtime.
- **Android:** existing app source is unchanged. Keep its current pairing bridge running until a separately tested migration replaces it.

## Only required browser configuration

Set these two public values in Vercel Project Settings → Environment Variables (or `.env` for local development):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The repository includes the current public Supabase defaults in `src/lib/supabase.ts` so a missing local `.env` does not cause a confusing setup screen. A publishable/anon key is intended for browser use; **never put a service-role or secret key in a `VITE_` variable**. Security depends on database grants and RLS, not hiding the public key.

## Local run and checks

```bash
npm install
npm run dev
```

Before release, run:

```bash
npm run audit:source
npm test
npm run test:acceptance
npm run lint
npm run build
```

## Release status

This is a **simplified QA candidate**, not yet production-approved. Dependency-backed lint/build and PostgreSQL migration execution still need to pass in an environment with package registry access and an isolated database. Do not apply the listed migrations blindly to production. Follow `docs/DEPLOYMENT.md` for the exact migration list and verification requirements.

## Core workflow

Admin approves a user and assigns one team. Users cannot choose or switch teams; after approval they are routed to their assigned workspace. Pending users remain on the pending-access page. Website workflow actions use authenticated Supabase RPCs and database-side authorization.

## Project layout

- `src/` — frontend.
- `src/lib/supabase.ts` — public Supabase client configuration.
- `src/services/webApiClient.ts` — authenticated RPC client.
- `supabase/migrations/` — backend schema and security changes.
- `docs/` — deployment steps, QA blockers, Android notes, optional legacy cleanup SQL.
- `CHANGELOG.md` — what changed in this release.


## v2.14.5 update

- Report ZIP selection/cancellation hardened for mobile browsers; profile hydration now falls back to the authenticated self-profile RPC if a direct profile SELECT fails.
- Evidence navigation is limited to Assign Links and Evidence Pairing; Searching opens directly to Paste Links.
- Team/gender lead selectors load authorized user lists through the admin-only RPC.
- Site Assets now includes full pledge text, organization name, and official signature-label settings.
- The gender-lead backend validation change is included in `supabase/migrations/20261021042646_allow_admins_as_gender_team_leads.sql` and was applied to the connected Supabase project.

## v2.14.6 update
- Added a live A4 Urdu pledge PDF preview and adjustable font size, line spacing, and margins under Site Assets.
- Pledge PDF generation now wraps text dynamically and reduces body font size when needed to preserve a single-page layout for typical pledge text.
- Added a two-minute session-storage-backed profile hydration cooldown so returning from mobile file pickers does not repeatedly show profile/session checking. Supabase Auth remains the source of authentication; server-side authorization remains enforced.
- User Management now supports promoting an active member to TEAM_ADMIN before assigning a team lead in Team Analytics. The current senior admin is displayed but disabled for self-assignment, matching the backend rule.

QA note: source syntax transpilation passed for all 82 TypeScript/TSX/JS source files. A full dependency-backed build could not be run in this environment because npm dependency installation timed out.


### v2.14.8 backend status

Migration `20261021062000_mfp_gender_scoped_activity_score.sql` is applied to the connected Supabase project. Member Activity Score uses actual work in the rolling 24-hour window (10 points per link action, capped at 100). Senior ADMIN remains global; team analytics restricts Team Admin results to the assigned team and admin gender group. This does not certify gender isolation across every workflow RPC and does not yet provide the final per-functional-team Male/Female admin assignment UI.


## v2.14.11 — Evidence ZIP identity tracking

- Global Tracker now reads the authorized screenshot-ID metadata ledger and displays screenshot IDs, related link/profile/post IDs, verification status, and the original assignee.
- Evidence ZIP reconciliation checks uploaded URLs against reserved assignments and attributes records to the user who originally received each assignment, not the administrator uploading the ZIP.
- The database stores screenshot IDs and evidence metadata only; screenshot image bytes are not uploaded by the reconciliation RPC.
- Evidence assignment JSON includes available related post IDs and post URLs.
- Supabase migration: `20261022021800_mfp_evidence_zip_identity_tracking.sql`.


## v2.14.13 update
- ZIP analysis retrieves the configured archive password through an authenticated, admin-only Supabase RPC; the password is not hard-coded in the frontend or manually requested on every upload. Existing ZIP exports must use the password configured in Supabase.
- Physical evidence package folders now contain `links.txt` and a local `Screenshots/` subfolder together for each link batch. Unmatched screenshots remain isolated under `Unmatched-Review/Screenshots/`.
- A signed-in user can download their own previously submitted pledge PDF from My Profile.
- The administrator directory now includes `TEAM_ADMIN` records as well as senior `ADMIN` records, and requests up to 1,000 user profiles instead of only the first 100.
- Searching workspace filters out downstream Checking/Evidence terminal outcomes so it focuses on new links, handoff, duplicates, invalid links and review.

### Required Supabase migration
Apply `supabase/migrations/20261022030000_mfp_auto_zip_password_and_team_ui.sql` before deploying the frontend. This creates an authenticated admin-only password retrieval RPC. It reads the private website setting first, then falls back to the existing `public.config` export setting used by the Evidence app. It does not grant access to anonymous users.

### Verification notes
- The password RPC migration has been applied to the connected Supabase project and checked: function exists, `anon` cannot execute it, `authenticated` can invoke it (the function itself enforces active admin role), and the legacy Supabase `public.config` export password is configured. The password value was not retrieved for diagnostics.
- Frontend dependency installation timed out in this environment, so a full Vite production build and browser end-to-end test could not be completed here. Deploy only after CI/build passes.
- Team performance cards already refresh on a 30-second interval and use recorded Supabase activity. The requested time-based score decay and full multi-admin-per-team assignment model require a separate, end-to-end-tested workflow migration; this release does not claim those two policies are implemented.


## v2.14.14 update

- Multiple active administrators can be assigned to one team from **Team Analytics**. A Team Admin can manage one team only; only Senior Admin can change these assignments.
- Real-work activity score is calculated from the rolling 30-day action count (10 points per action, maximum 100), then multiplied by 0.75 after 3 inactive days or 0.50 after 7 inactive days. If there are no qualifying actions in the last 30 days, the score is 0.
- Supabase migrations applied: `mfp_multi_team_admins_and_inactivity_score_decay` and `mfp_require_multi_admin_assignment_payload`. The website ZIP is not deployed automatically; run build and acceptance checks before production deployment. Android source remains unchanged.


## 2.14.15 — Checking Team UX and Admin Link Exports

- Redesigned the Checking dashboard and link review into mobile-first cards with a clear Open → Review → Submit flow. Only one active link is shown at a time.
- Result actions appear after opening the link. Re-open remains available. Verified opens a modal that requires exactly three profile/post URLs; Invalid opens a required note box; Blocked offers only “By PTA” and “By Platform”, saving the selected reason as a system note without asking the checker to type one.
- Admin Link Management displays each link’s workflow status and offers separate plain-text downloads for Invalid and Blocked links.
- Android app source is unchanged. Frontend build and browser tests must be run after dependencies can be installed; this ZIP has not been deployed.


### v2.14.18 — Five ZIP code configuration
The five-code RPC migration, legacy RPC restriction, and Link Management pagination index have already been applied to the connected Supabase project; their SQL migration files are included for version control. In Admin → Evidence Control Center → Export settings, generate five secure codes or enter five unique custom codes, then save. ZIP analysis tests the five slots sequentially and displays which slot/label opened each archive. Passwords are not stored in report snapshots. Link Management now uses server-side pagination and full-dataset exports to avoid rendering thousands of rows at once.


## v2.16.4 note
This source package includes the team/gender settings migration at `supabase/migrations/20261025170000_mfp_team_gender_settings.sql`. Apply and verify this migration before deploying the updated team/gender settings UI. The complete end-to-end male/female isolation audit for all independent RPCs remains a required release gate; do not describe this as fully production-verified until those tests pass.
