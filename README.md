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
