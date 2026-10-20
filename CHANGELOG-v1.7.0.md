# MF MPanel v1.7.0 — Role-aware UI and admin cleanup

- Replaced generic bottom-bar links with role/team-specific destinations and matching icons. Searching, Checking, Report Generator, and Admin now see only their own navigation destinations; the center action is team-specific.
- Added the supplied MF banner to authentication screens and dashboard shell. Landing page also uses it as a soft hero overlay. Admin Assets now supports the `Site banner` asset type; active banner assets override the default image.
- Removed the Contact Us and Get in touch calls-to-action from the landing page.
- Improved landing hero text contrast over the white video with a white gradient and text shadows.
- Removed seeded example profiles/posts/checking records/workflow events so fresh local storage no longer displays sample/test records.
- Added admin-only bulk deletion for profiles surfaced in Duplicate Review and a duplicate review reason field.

## Verification status
- ZIP structure and static source checks completed.
- `npm install` timed out in the build environment, so production build and live Firebase permissions/routing could not be verified here. Deploy to a staging site and test each role before production use.
