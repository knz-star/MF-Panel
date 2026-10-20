# MF MPanel source review — v2.4.1

## Changed
- Team onboarding now displays only administrator-assigned workspaces and never writes a team assignment from the user-facing page.
- Multi-module assignments are preserved by Admin → User Management; `hasModuleAccess` checks assigned modules rather than a single `team` field.
- Evidence is now an assignable module in the admin user editor.
- The landing hero video is controlled by Admin → Assets through `siteSettings/landing.heroVideoUrl`; public landing reads the same setting.
- New authenticated profiles are persisted to Supabase during profile hydration, rather than remaining local-only.
- Removed unused public project ID export from the landing data module.
- Added a database migration for scoped `mfp_documents` RLS, public reads for active landing assets/public landing settings, admin-only landing-content writes, and revoked authenticated execution of the old self-assignment RPC.

## Static validation
- TypeScript/TSX transpile syntax check: 70 files scanned, zero syntax errors.
- Relative import existence check: zero missing relative imports.
- Routes: wildcard Not Found route exists.
- Supabase migration: applied successfully to project `nvzvyzgantmtwjfnrqdo`.

## Not verified in this environment
- Full `npm run lint`, unit tests, and production `npm run build`: dependencies could not be installed because npm registry/cache was unavailable in this environment.
- Live browser tests for signup, admin assignment, multi-team routing and video playback require a deployed frontend session.
- Existing legacy user/team records may need admin review before users see assigned teams; no user/workflow/evidence data was deleted.
