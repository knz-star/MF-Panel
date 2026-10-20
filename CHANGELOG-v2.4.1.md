# MF MPanel v2.4.1 — Workspace routing and landing video

- Replaced self-selected team onboarding with a workspace chooser that lists only modules assigned by an administrator.
- Multi-team users can choose a workspace each time they enter `/dashboard`; single-team users are redirected directly.
- Updated module access checks to honor admin-assigned `allowedModules` rather than enforcing a single-team-only profile.
- Admin user management now supports the Evidence module in addition to Searching, Checking, Reports and Admin.
- Added admin-managed landing hero video URL in Admin → Assets; it is saved to `siteSettings/landing.heroVideoUrl` and read by the public landing page.
- Removed the unused public project-ID export from the landing data module.
- Added Supabase `mfp_documents` RLS policies for public landing settings/active assets and admin-only landing content writes.
- Revoked direct authenticated execution of the legacy `mfp_assign_team` RPC to prevent users assigning themselves teams.
- Updated signup guidance to explain that workspace access is assigned by an administrator.

## Validation notes

- Supabase migration was applied successfully to project `nvzvyzgantmtwjfnrqdo`.
- TypeScript/build validation could not complete in this environment because dependencies are not installed and npm registry access was unavailable. Run `npm install`, `npm run lint`, `npm test`, and `npm run build` in CI before publishing the ZIP.
- New authenticated user profiles are now persisted to the Supabase-backed `users` document immediately after login/profile hydration instead of being left local-only; team permissions remain empty until admin assignment.
