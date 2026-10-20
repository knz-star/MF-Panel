# MF MPanel v2.1.1 — Routing and Evidence Backend Diagnostics

## Fixed
- Registered `/admin/tests`, which was linked from the Admin Dashboard and navigation but missing from the router. Previously it fell through to the wildcard and silently redirected to the public landing page.
- Moved `/dashboard` role-based redirect to an explicit top-level route so it resolves directly to the correct admin/team workspace.
- Replaced the wildcard redirect-to-landing behavior with a visible route diagnostic page that shows the unmatched URL.
- Added structured Cloud Functions logging for unexpected `createEvidencePairing` backend failures, with a reference ID returned to the UI. Expected `HttpsError` codes remain intact.

## Important
- These code changes must be deployed to the active hosting and Firebase projects before they affect the live website.
- If Evidence pairing still reports `functions/internal`, find the matching `EVPAIR-...` reference in Firebase Console → Functions → Logs. The backend now logs the underlying exception and stack trace.
- Never publish Firestore rules or functions to a different Firebase project than the web app's configured `projectId`.
