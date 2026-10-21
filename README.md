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
