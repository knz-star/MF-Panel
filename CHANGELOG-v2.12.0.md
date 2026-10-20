# MF MPanel v2.12.0 — Report formats, manifest matching, workspace reports

## Added
- Signup Male/Female selection persisted in Supabase profile metadata and canonical profile fields.
- Stable public profile identity `MFP` + 16 digits and per-profile post labels `MFP1`, `MFP2`, etc. Existing internal IDs remain unchanged.
- Assign Links now provides a batch JSON export alongside the URL-only TXT, including batch metadata, public MFP profile IDs, and internal source IDs.
- Report Generator batch JSON import and optional AES ZIP password support using zip.js.
- Manifest-aware URL/screenshot matching, duplicate SHA-256 warnings, required screenshot count checks, and source manifest preservation.
- Physical ZIP output with URL-only `links.txt` files and separate Screenshots folder.
- Online ZIP output with screenshot PDF (split into numbered 100-page parts for large evidence sets) and a links ZIP containing URL-only TXT files, grouped by Admin-selected quantity.
- Organization/team reporting for daily, weekly, 14-day, monthly and custom ranges, plus team-scoped sharing.
- Team Admin analytics support for the Reports workspace.
- Separate Male/Female Team Admin assignment and dashboards with server-side gender-group scoping.
- Organization report sharing supports separate scoped copies for functional teams and gender groups; the organization master remains Admin-only.

## Security and correctness
- Admin-only Report Generator route guard retained; backend ZIP reconciliation checks active Admin role.
- Organization report creation is authorized by the Edge Function; team users can generate only their own team scope.
- Shared copies are created per team so member-level records from other teams are not included in a team's copy.
- RLS allows reading only explicitly shared organization report copies (alongside existing policy access).
- Admin link deletion still verifies the row is actually absent after delete and reports failed IDs.

## Not yet verified
- Full dependency-backed build/tests were not completed because dependency installation timed out.
- SQL migrations, Edge Functions, Supabase RLS, encrypted ZIPs, PDF output and Netlify deployment must be tested in staging before production release.
