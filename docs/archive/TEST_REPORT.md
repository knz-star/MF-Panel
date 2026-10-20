# MF MPanel v1.4.3 — Test Report

Date: 2026-10-15

## Static checks performed

- Verified the Firestore user create rule permits both the unassigned profile and team-selected profile shapes produced by the client, including legacy unassigned USER/SEARCHER/CHECKER profiles.
- Verified the one-time team assignment update rule allows only `team`, `allowedModules`, `teamConfirmed`, and `updatedAt` changes, while preserving existing role/account status where present.
- Verified the two unsupported URL regex patterns were replaced with `size()` checks and `matches('https?://.*')`.
- Verified the team selection page now gives a more specific permission-denied message.
- Verified JSON configuration files parse and ZIP archive integrity after packaging.

## Not tested / not claimed

- Firebase Rules Emulator or live Firestore authorization tests: NOT RUN; no project credentials or live test session are available here.
- `npm install`, TypeScript check, and production build: NOT RUN; dependencies are not installed in this environment.
- Live Firebase rules deployment: NOT PERFORMED.
- Live Auth signup/team-selection flow: NOT TESTED.

## Required verification by project owner

1. Publish this ZIP's `firestore.rules` to Firebase project `mf-mpanel`.
2. Sign out and sign back in to refresh the user's auth state.
3. Select a team and check that `users/{uid}` now has `team`, `allowedModules: [team]`, and `teamConfirmed: true`.
4. If it still fails, capture the full Firebase error code and the Firestore Rules Playground result for an update/create on `users/{uid}`. Do not replace rules with open access as a workaround.
