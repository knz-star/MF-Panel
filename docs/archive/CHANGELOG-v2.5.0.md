# MF MPanel v2.5.0 — Account Review & Admin Link Controls

## Implemented in website source
- New account profiles default to `PENDING` rather than appearing active before review.
- Added Urdu pledge page with typed signature, submission timestamp, and downloadable copy.
- New account path goes through pledge submission and admin review before workspaces activate.
- Team selector supports selecting then entering one of multiple assigned workspaces; users cannot self-assign teams from this page.
- Admin user management defaults missing statuses to Pending and only marks team access confirmed when an account is Active and has at least one assigned module.
- Added Admin → Link management with search, multi-select and deletion for `posts` records. Evidence files are not deleted by this page.
- Login/signup show user-friendly errors rather than raw backend diagnostics.
- Evidence performance filters now include 7, 14, 30 and 90 day periods.
- Local seed arrays remain empty; no synthetic sample records were added.

## Validation and limits
- TypeScript/TSX syntax transpilation passed for source files.
- Full `npm run build`, `npm run lint`, and browser end-to-end tests could not be run because dependency installation did not complete in this environment.
- The existing performance backend still calculates Evidence-specific metrics. Cross-team scoring for Searching, Checking, and Reports requires their event schemas and aggregation rules and is not represented as completed by this release.
- Existing real database rows were not mass-deleted because they cannot be safely distinguished from production data without an explicit test-data marker.
