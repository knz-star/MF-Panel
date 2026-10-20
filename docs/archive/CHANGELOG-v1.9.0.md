# MF MPanel v1.9.0 — Stability and Admin Navigation

- Removed the site banner from the landing hero and all authenticated workspace screens. The managed/fallback banner is now shown only on Login and Signup (16:9).
- Removed the Admin module from the public landing Products menu and removed the Docs button from the public floating navigation.
- Added responsive Admin sidebar on desktop and a mobile More menu listing the remaining admin pages.
- Simplified team navigation so each team uses one bottom navigation bar without the old floating plus action.
- Added Admin → System tests for Firebase connectivity, authentication state, URL extraction and read access to key Firestore collections.
- Reworked bulk link import to avoid one Firestore lookup per pasted URL; the import supports up to 10,000 extracted URLs and writes profiles/events in bounded Firestore batches. Cloud writes are awaited, and permission failures are surfaced instead of reporting false success.
- Checking decision writes are awaited so a rejected Firestore write appears as an actionable error.
- Kept Firestore rules restrictive; the diagnostics screen does not publish rules or bypass access control.

## Verification

- ZIP integrity checked after packaging.
- TypeScript/build/tests could not be run in this environment because dependency installation timed out (`vite/client` is unavailable locally).
- Live Firebase rules and Netlify deployment have not been verified from this environment. Deploy the complete `firestore.rules` file in Firebase Console and run Admin → System tests after deployment.
