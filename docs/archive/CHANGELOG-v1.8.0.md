# MF MPanel v1.8.0 — Crash, Banner, Permissions & Theme Fixes

- Fixed `siteBanner is not defined` by passing the active banner URL into the Landing Page Hero component.
- Standardized banner rendering to a 16:9 aspect ratio on the landing hero, login, signup, team workspace and admin asset preview.
- Removed the extra floating plus action from the bottom navigation; each role now sees only its relevant navigation destinations.
- Updated primary accent styling from emerald/purple/indigo to a blue, black and white palette.
- Updated `firestore.rules` to explicitly permit `banner` as a valid `landingAssets.assetType` for admin create/update operations.
- Login and signup now use the active admin-managed banner, with the supplied banner URL as fallback.

## Required Firebase step
The rules change is included in this ZIP but cannot take effect on the live site until `firestore.rules` is published to the Firebase project used by the deployed app. Deploy/publish the rules, then reload the site and test Admin → Assets → Site banner. Do not replace the full rules file with a fragment.

## Verification status
ZIP integrity and source-level checks were performed. Dependency installation timed out in this environment, so a Vite production build and live Firebase permission checks could not be completed here.
