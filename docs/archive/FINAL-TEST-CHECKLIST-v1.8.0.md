# Final Test Checklist — v1.8.0

- [ ] Publish the included `firestore.rules` to the correct Firebase project.
- [ ] Sign in as admin and create/update an active Site banner.
- [ ] Confirm the banner can be read on Landing, Login, Signup and each team workspace.
- [ ] Confirm banners render in 16:9 and crop cleanly on mobile and desktop.
- [ ] Confirm no `siteBanner is not defined` runtime error.
- [ ] Confirm bottom navigation has no floating plus icon and only role-specific destinations.
- [ ] Confirm primary UI accents use blue, black and white.
- [ ] Run `npm install`, `npm run lint`, `npm test`, and `npm run build` in CI or a network-enabled environment.
- [ ] Test all Firestore reads/writes with the real signed-in admin and team accounts.
