# MF MPanel v2.12.0 — Step 2: Reports & Validation

This release is the second checkpoint after `MF-MPanel-v2.12.0-STEP1-CORE-SECURITY.zip`.

## Assign Links and Report Generator
- Assign Links downloads a URL-only TXT and a batch JSON containing `batchId`, `batchName`, `createdAt`, `createdBy`, link IDs, URL/platform, social `profileId`, public MFP profile ID, internal source profile ID, required screenshot count and notes. The batch is reserved before either export is offered.
- Report Generator remains Admin-only in the React router; the `mfp-link-workflow` Edge Function independently checks that ZIP reconciliation is performed by an active Admin.
- Admin can upload the batch JSON separately, use an embedded `manifest.json`, and provide an optional AES ZIP password. Password input is not persisted by the app.
- Manifest URLs are deduplicated against TXT URLs and matched against the central profile/post records. `linkId` is retained as a batch reference.
- Screenshot filename/checksum/timestamp metadata is used when available. Duplicate SHA-256 screenshots, extra screenshots beyond the required count, missing URL matches, and count mismatches require review; they are not automatically verified.
- The report ZIP preserves the source batch manifest and report summary.
- Link TXT files contain only URL lines. Admin chooses 1–2000 links per folder/file.
- Physical report ZIP: `Folder-001/links.txt`, `Folder-002/links.txt`, etc., and a separate top-level `Screenshots/` tree.
- Online report ZIP: `screenshots.pdf` (or numbered PDF parts for large evidence sets), `links.zip` (same folder/link count structure), report metadata, and the source manifest when supplied.

## Workspace reports and team dashboards
- Added `/workspace/reports` and `/shared-reports` for daily, weekly, 14-day, monthly, and custom date ranges.
- Reports include record counts, team/user activity, profiles/posts with public MFP IDs, statuses, and report truncation notices when query limits are reached.
- Admin-generated organization reports are saved privately for Admins; each selected team receives a scoped copy containing only that team's member-level details and link records.
- Team members can generate reports scoped to their own authorized team. Sharing to another team is rejected server-side.
- Expanded Team Admin analytics assignment support to include the Reports team.
- Signup gender is saved in the canonical Supabase profile; Admin Users displays the gender group. Admin can assign same-gender Team Admin leads for separate Male/Female dashboards. Gender is not a functional-module permission grant.
- Added `/admin/gender-teams` with server-enforced gender-group access, group members, work by workspace, profile/post IDs and lead assignment/removal.
- Organization reports can be shared as separate functional-team or gender-group copies; each copy is scoped to its recipient group and the private organization master remains Admin-only.

## Migrations to apply in order
1. `20261020120000_mfp_gender_profile_post_ids.sql`
2. `20261020123000_mfp_organization_reports_sharing.sql`
3. `20261020124500_mfp_reports_team_admins.sql`
4. `20261020125500_mfp_gender_team_admins.sql`

Review/apply the migrations in staging before production. They are additive to MF MPanel tables and do not modify Android source code.

## Validation performed in this workspace
- `scripts/audit-required-functions.sh`: passed; all frontend Edge Function calls have local source.
- Shell syntax checks: passed.
- TypeScript/TSX parser syntax pass across source and Edge Functions: passed (98 files, zero syntax diagnostics).
- ZIP integrity: verified after packaging.
- Full Vite build and dependency-backed tests: **not verified** because `npm install --ignore-scripts --no-audit --no-fund` timed out in this environment.
- SQL migrations, AES ZIP decryption, PDF rendering, RLS sharing, concurrent ID generation, and live Supabase/Netlify deployment: **not run against production**. Do not treat this ZIP as deployed or production-tested until the staging test plan passes.
