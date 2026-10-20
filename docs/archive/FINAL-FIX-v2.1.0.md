# MF MPanel Final Stability Fix v2.1.0

## Changes
- Firestore profile hydration now reads from the server and surfaces permission/network errors instead of silently treating them as a missing profile.
- Authentication no longer fabricates an ACTIVE profile when Firestore profile hydration fails; protected routes block workspace access and show a source diagnosis.
- Added an error diagnosis panel to login/signup, Evidence Linking, Get Links, protected profile-load failures, and the global render error boundary. It labels errors as Frontend, Cloud Functions backend, Firestore backend, Firebase Auth/configuration, Network, or Unknown and shows the Firebase error code/message when available.
- Added the required composite Firestore index for the Evidence dashboard's `currentWorkflowStatus + platform` aggregation queries.
- Admin bootstrap/module profiles now include Evidence access.
- Firestore rules allow the `evidence` team in the one-time team assignment path and restrict admin marker reads to the owner/admin.

## Deployment order
1. Deploy rules and indexes: `firebase deploy --project mf-mpanel --only firestore:rules,firestore:indexes`
2. Build and deploy functions from project root: `npm --prefix functions install && npm --prefix functions run build && firebase deploy --project mf-mpanel --only functions`
3. Build the frontend: `npm install && npm run lint && npm test && npm run build`
4. Deploy the generated `dist/` directory to the existing Netlify site, or use the connected repository's normal production deploy.

## How to identify an error
- `functions/internal`, `functions/not-found`, etc. → Cloud Functions/backend. Check Firebase Console → Functions → Logs and verify that the function is deployed in `us-central1`.
- `permission-denied`, `firestore/*`, `missing or insufficient permissions` → Firestore backend/rules/project.
- `auth/*`, `auth/invalid-api-key` → Firebase Authentication or frontend Firebase project configuration.
- `TypeError`, `SyntaxError`, chunk-load/rendering errors → frontend JavaScript/build.
- Network/offline/timeout errors → connectivity or Firebase endpoint; the UI will label these separately.

## Verification status
The source changes are included, but build/tests and live Firebase deployment must be run in an environment with dependencies and access to the target Firebase/Netlify projects. Do not consider the live service fixed until the deployment steps and the end-to-end test checklist pass.
