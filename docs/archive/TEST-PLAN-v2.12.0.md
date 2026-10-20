# MF MPanel v2.12.0 staging acceptance plan

## 0. Deployment gate
- Do not apply migrations directly to production before a staging backup/review.
- Apply migrations in timestamp order: gender/IDs, report sharing RLS, reports-team assignments.
- Deploy `mfp-link-workflow`, `mfp-organization-reports`, and `mfp-team-analytics` using `scripts/deploy-required-functions.sh`.
- Run `npm ci` (or `npm install` if no lockfile exists), `npm run audit:source`, `npm run test`, `npm run test:acceptance`, `npm run lint`, and `npm run build`.

## 1. Signup and role access
- Create a new Male signup and a new Female signup; verify both email confirmation flows still work.
- Verify `mfp_user_profiles.gender` and `gender_group` contain the selected values.
- Confirm a user cannot change their stored gender through a direct authenticated profile update.
- Confirm ordinary users cannot open `/reports`, `/reports/new`, or `/reports/jobs` and cannot invoke `mfp-link-workflow` action `match-zip`.
- Confirm Admin can access Report Generator; Team Admin cannot access it.

## 1b. Gender-group teams
- Assign an active Male Team Admin to Male and an active Female Team Admin to Female; cross-gender assignment must be rejected by the Edge Function.
- Confirm each lead sees only their gender-group members/work on `/admin/gender-teams`; a normal user or unassigned Team Admin gets no data.
- Remove a lead and confirm access is revoked immediately.

## 2. Stable public IDs
- Create one profile and three posts under it; confirm public profile ID format `MFP` + 16 digits and post labels `MFP1`, `MFP2`, `MFP3`.
- Create another profile with posts; confirm its public profile ID is unique and its post labels start at `MFP1`.
- Update profile/post metadata and confirm IDs do not change.
- Confirm existing PRF/PST internal document IDs are preserved and old URLs continue to resolve.
- Confirm a screenshot named only `MFP1.jpg` is marked Needs Review if multiple profiles have an `MFP1`; a parent profile MFP ID must disambiguate it.

## 2b. Assigned batch JSON
- Assign 1, 10 and 2000 links; verify links are reserved before download and unavailable to other users.
- Verify TXT contains only URLs and JSON contains batch metadata, linkId, platform, social/public profile identifiers, screenshot requirement and notes.
- Confirm a metadata lookup failure after reservation still returns a usable export with internal ID fallback rather than a false failed assignment.

## 3. Manifest + ZIP analysis
- Upload the batch JSON and an unencrypted Evidence ZIP; confirm URL matching uses exact URL normalization and batch link IDs.
- Upload AES-encrypted ZIP with correct password; confirm it opens. Repeat with wrong password and confirm a clear error, no false success.
- Use a manifest with one required screenshot and four actual screenshots; confirm extra screenshots are marked Needs Review.
- Duplicate a screenshot byte-for-byte and repeat; confirm identical SHA-256 values are flagged and not counted as independent approved evidence.
- Use an unknown URL; confirm it remains unmatched and is not marked verified.
- Use a manifest that lists A01 and A04 while the separate batch JSON includes A01-A04; confirm A02/A03 are not incorrectly counted as missing evidence from the export.

## 4. Physical/online report formats
- Set links per file to 1, 10, 100, and a custom value; verify every `links.txt` contains only URLs (one per line), with no labels or metadata.
- Physical ZIP must contain `Folder-###/links.txt` plus a separate `Screenshots/` directory.
- Online ZIP must contain `screenshots.pdf` (or numbered PDF parts when more than 100 screenshots) and `links.zip`; `links.zip` must contain the same configurable folders and URL-only text files.
- Confirm source manifest and report manifest are present when supplied.
- Confirm PDF includes all screenshots or a visible review placeholder when an image cannot be embedded; duplicate/unmatched items are marked for review.

## 5. Organization reports and sharing
- Generate daily, weekly, 14-day, monthly, and custom date-range reports.
- Confirm report totals are based on stored data and a truncated warning appears when a query hits the safety cap.
- As Admin, share an organization report with one team; confirm the master stays Admin-only and the shared copy includes only that team's member-level records and link records.
- As a team member, generate a report; confirm it is scoped to their own team and attempts to share to another team are ignored/rejected by the Edge Function.
- Confirm functional-team and gender-group report copies are visible only to the intended group and invisible to other teams/groups through direct Data API requests.

## 6. Team Admin and bulk deletion
- Assign a Team Admin to Searching, Checking, Reports, and Evidence teams; confirm `/admin/analytics` only shows the assigned team for each Team Admin.
- Confirm Admin can select multiple profile and post records, delete them, and see verified deletion counts. Simulate an RLS failure and confirm the failed IDs are reported.
- Verify normalized `mfp_profiles` / `mfp_posts` rows remain consistent after source document deletion.

## 7. Release sign-off
- Run tests with two separate normal accounts and one Admin account.
- Confirm no Android source files changed.
- Confirm deployment only after all above checks pass; current working copy has not been deployed.
