# MF MPanel v2.11.0 — Admin-only Report Generator

## Implemented in this increment
- `/reports`, `/reports/new`, and `/reports/jobs` now require the application's verified Admin role at the route guard.
- Non-admin navigation no longer includes the Reports workspace, and the user dashboard no longer exposes the New ZIP Analysis shortcut.
- Existing admin navigation retains Report Generator access.
- Version updated to 2.11.0.

## Important: next planned work, not yet implemented
The user will provide sample JSON/report-checking examples before the final report schema is fixed. The following remain for the next increment: assigned-link JSON export in the exact agreed format; organization daily/weekly/14-day/monthly/custom reports and sharing; stable 16-digit MFP profile IDs plus MFP1/MFP2/MFP3 post references; and a verified, server-authorized bulk-delete flow for admin link management. Do not treat these as implemented in this ZIP.

## Security note
The UI route guard prevents ordinary users from opening report pages. Any future report creation/export backend action must independently verify the authenticated Admin role; frontend checks alone are not sufficient.
- `mfp-link-workflow` ZIP matching now independently requires Admin and reconciles pending assignments across all users, returning the matched assignment owner and IDs to the admin report workflow.
- Link management now preserves the verified delete outcome message while refreshing the list, instead of clearing the message during refresh.
