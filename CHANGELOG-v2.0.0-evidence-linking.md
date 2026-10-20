# MF MPanel — Evidence App Linking update

## Added
- `/dashboard/evidence-linking` pairing page with a five-minute one-time code and live registration status.
- `/dashboard/get-links` protected JSON export of existing `VERIFIED` profiles, paginated in 500-record pages; failed/blocked and unchecked records are excluded.
- Callable backend operations for pairing creation, pairing completion, cancellation, disconnection, access verification, dashboard summary, protected link pages, and download audit events.
- Dashboard status card across Searching, Checking, Report Generator, and Admin dashboards.
- Firestore rules and index for owner-scoped registration visibility and backend-only status mutations.
- Android integration contract in `EVIDENCE-APP-INTEGRATION.md`.

## Security behavior
- Pairing uses a cryptographically random code; only its hash is persisted.
- Pairing checks the authenticated UID, account status, team assignment, expiry, and consumed status in a Firestore transaction.
- Registration IDs are deterministic per UID/application to avoid duplicate registrations.
- Protected link pages and export audit events require a currently active backend registration.
- Client writes to pairing, registration, rate-limit, and connection-event collections are denied.

## Not yet verified
- No live deployment was performed.
- Automated build/test commands could not be completed in the current environment because package installation did not finish.
- The Android source was not present in the supplied archive and must be integrated separately.

## Follow-up fix: Evidence Team visibility and admin connections
- Restricted Evidence linking authorization to the dedicated `evidence` team (administrators remain able to manage connections).
- Added Evidence Team to the team selection and its own navigation with Get Links.
- Removed Evidence App status cards and navigation entries from Searching, Checking, and Report Generator workspaces.
- Added an administrator-only Evidence Connections page with linked-user counts, status, team, device label, last sync, and revoke access action.
- Improved user-facing diagnostics for missing/unavailable/internal Cloud Functions errors. A missing function still requires deploying the current Firebase Functions bundle.
