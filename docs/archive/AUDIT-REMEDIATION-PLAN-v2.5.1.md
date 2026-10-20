# MF MPanel — Audit remediation tracker

This tracker is source-only. It does not mean any live Supabase change has been applied.

## Fixed in the current working copy
- [x] Multi-module users can navigate to every workspace already granted in `allowedModules`; mobile additional links remain available through More.
- [x] User-facing profile page (`/profile`) lets a signed-in user update their display name and review account state and authorized workspaces.
- [x] Admin user editor shows pledge acceptance, submitted signature, and submission timestamp before account review decisions.
- [x] UI copy now distinguishes workspace/module grants from actual relational team memberships.
- [x] Android source remains untouched.

## Still requires schema / workflow verification before implementation
- [ ] Real team management (`mfp_web_teams` and `mfp_web_team_members`): inspect exact columns, RLS, intended team semantics, and existing data before adding create/edit/member assignment UI. Current module grants are not proof of real team membership.
- [ ] Queue assignment/reassignment and stuck-work review: establish current assignment fields, server-side transition rules, and role permissions first.
- [ ] Evidence link assignment/reassignment/revocation: verify existing Edge Function contract and avoid exposing evidence images or privileged keys.
- [ ] Notifications: inspect `mfp_web_notifications` columns and RLS before creating user inbox/admin broadcast pages.
- [ ] Reports job administration: inspect report job source-of-truth and allowed retry/cancel transitions.
- [ ] User activity history: distinguish per-user records from admin-wide audit events before adding a user view.
- [ ] Personal settings: identify which existing settings are global/admin-only and which are user-specific before exposing controls.
- [ ] Pledge review history/audit: current UI shows available pledge fields but does not add an immutable review log.
- [ ] Review known live database RLS concerns (pairing code public read/write, permissive metadata inserts, export settings exposure) against the deployed schema and Android compatibility before drafting any migration. No policies are changed by this source patch.

## Validation status
- TypeScript/TSX transpilation syntax check: 73/73 source files passed.
- `npm install` did not complete within the environment timeout; `npm run build`, full typecheck, and browser/E2E checks remain unverified.
- No production deployment, live SQL, live data, RLS policy, or Android source change was made.
