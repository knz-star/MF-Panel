# MF MPanel v2.5.1 — Multi-workspace navigation parity

## Fixed in website source
- Users with multiple administrator-granted modules now see navigation entries for every authorized workspace, instead of only the legacy single `team` field's workspace.
- Mobile navigation uses the combined authorized workspace list; additional pages remain available through **More**.
- The header now indicates when an account has multiple authorized workspaces.
- Updated user-management copy to distinguish workspace/module access from actual relational team membership.
- Updated the workspace selector wording so it no longer implies that module grants are real team-table memberships.
- Added a protected `/profile` page so users can update their display name and review their email, account status, role, and authorized workspaces. The sign-in email is read-only.

## Scope and validation
- Website source only. No Android app source changed.
- No live Supabase schema, policies, rows, or production settings changed.
- This fixes navigation parity for the existing `allowedModules` permission model. It does **not** implement real `mfp_web_teams` / `mfp_web_team_members` CRUD or prove that relational team memberships are wired into the app; that remains a separate audit/fix item.
- Runtime build and browser tests are pending dependency availability. Source-level syntax validation is being performed before the working copy is considered ready.
- Added a pledge-review summary to the admin user editor, showing the submitted signature and timestamp alongside pledge status before the admin changes account approval.
