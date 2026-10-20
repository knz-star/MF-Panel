# MF MPanel v1.7.0 — Final acceptance checklist

1. Sign in as Searching Team: bottom bar shows Workspace, Import links, Profiles, Posts, plus Import links action. No Checking/Report/Admin links.
2. Sign in as Checking Team: bottom bar shows Workspace, Review queue, Verified, Failed, plus Review queue action. No Searching/Report/Admin links.
3. Sign in as Report Generator: bottom bar shows Workspace, New report, Report jobs, plus New report action. No other team's links.
4. Sign in as Admin: bottom bar shows Admin Home, Users, Assets, Duplicates, plus Add user action.
5. Verify every bottom-bar destination opens without Access Denied for that role. Admin team overview routes remain subject to their existing route guards.
6. Landing page has no Contact Us / Get in touch CTA. Verify hero headline and paragraph remain readable against the white video.
7. Login, Signup, Landing and each protected dashboard display the supplied banner by default.
8. Admin → Assets: add or edit an active asset with type `Site banner`; verify it replaces the default banner on Landing, Login, Signup, and dashboards.
9. Duplicate Review: select profiles and remove only after confirmation; add a duplicate review reason and verify it is saved.
10. Verify Firestore rules allow intended admin profile deletes and duplicate review updates. Test on staging first; do not assume client UI replaces security rules.
11. Run `npm install`, `npm run lint`, `npm run test`, and `npm run build` in CI/staging before production deploy.
