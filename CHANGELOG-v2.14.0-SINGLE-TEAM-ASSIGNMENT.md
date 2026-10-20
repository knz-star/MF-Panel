# MF MPanel v2.14.0 — Single-Team Assignment

- Removed Team Selection page and `/select-team` route.
- Removed workspace switching control and client calls to `mfp_select_team`.
- Admin now assigns one primary team to each standard user; Admin accounts retain all-team access.
- Users automatically route to the assigned team after approval.
- Added pending approval/team assignment screen with a refresh-access action.
- New signups are pending by default until Admin approves and assigns one team; active standard accounts with no team are moved to pending.
- Updated route guards so a user's primary team, not merely a UI module grant, determines workspace access.
- Removed creation of the obsolete `mfp_select_team` RPC from the pending migration set.
- Preserved the existing Android pairing bridge and did not change Android source.

Validation results are recorded after running the project checks; production deployment and live migrations remain separate steps.
