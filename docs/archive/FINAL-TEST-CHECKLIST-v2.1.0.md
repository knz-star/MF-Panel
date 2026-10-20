# MF MPanel v2.1.0 Final Verification Checklist

## Build checks
- [ ] `npm install`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm --prefix functions install && npm --prefix functions run build`

## Firebase deployment
- [ ] Confirm Firebase project is `mf-mpanel` (or set the intended `VITE_FIREBASE_*` variables consistently).
- [ ] `firebase deploy --project mf-mpanel --only firestore:rules,firestore:indexes`
- [ ] `firebase deploy --project mf-mpanel --only functions`
- [ ] Confirm callable functions exist in `us-central1`: `createEvidencePairing`, `cancelEvidencePairing`, `disconnectEvidenceApp`, `getEvidenceDashboardSummary`, `getEvidenceLinksPage`, `recordEvidenceLinksDownload`, `listEvidenceConnectionsForAdmin`.
- [ ] Confirm the new composite index for `profiles(currentWorkflowStatus, platform)` is READY.

## End-to-end checks
- [ ] Sign in as normal user; profile read succeeds and role/team are read from Firestore, not synthesized.
- [ ] Assign `evidence` team; `users/{uid}` is created/updated and team selection survives refresh.
- [ ] Open Evidence Linking as Evidence Team; it is hidden from other non-admin teams.
- [ ] Generate a code; verify it expires in 5 minutes and cannot be reused.
- [ ] Pair the Android app using the same Firebase UID; confirm registration becomes ACTIVE.
- [ ] Verify Get Links returns only VERIFIED profiles and records a download event.
- [ ] Disconnect; confirm subsequent protected calls are denied.
- [ ] Admin sees linked users on `/admin/evidence-connections`.
- [ ] Intentionally test a missing function, Firestore permission error, and frontend runtime error; confirm the visible diagnostics label the source correctly.

## Important
A green frontend build does not prove that live Firebase rules/functions are deployed. Treat production as verified only after the Firebase deployment and end-to-end checks above pass.
