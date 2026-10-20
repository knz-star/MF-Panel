# MF MPanel v2.10.0 verification checklist

## Before deploy
- Review the new migration; it creates only `mfp_*` tables/functions and does not delete existing rows.
- Apply the migration before deploying `mfp-link-workflow`.
- Deploy the Edge Function with JWT verification enabled.
- Deploy the website to Netlify.

## Assign Links
1. Sign in as an authorized Evidence/Reports/Searching member and inspect per-platform counts.
2. Request a small batch (e.g. 3 links); verify a TXT download and that available counts drop by the returned count.
3. Sign in as a second user and confirm the same URLs are not offered again.
4. Upload a ZIP containing two assigned URLs plus an unrelated URL; confirm only the two assignments are marked RECEIVED and the unrelated URL is unmatched.
5. Upload the same ZIP again; confirm already received assignments are not counted as new pending matches.

## Checking privacy and uniqueness
1. Queue at least 12 eligible profile links.
2. Sign in as checker A, click Open repeatedly and verify only one card/link is visible at a time.
3. Sign in as checker B; verify none of A's reserved profiles are assigned to B.
4. Submit Reopen/Recheck and confirm the same checker can continue that link.
5. Submit Blocked/Invalid with a note; submit Verified with either zero or three post URLs; confirm partial (one or two) is rejected.
6. Confirm ordinary checker routes for queue/verified/failed redirect to the single-card workspace and admin-only results are visible only to admins.

## Link Management and scoring
- Admin Link Management should show both `profiles` and `posts`; delete one test record and verify it is actually absent. If it remains, inspect RLS DELETE policy.
- Check Searching/Checking scores with real timestamps; do not use cookie counters as a score source. Evidence Team's existing outcome score remains unchanged.

## Known validation status
- ZIP integrity and source-function audit passed during packaging.
- Full Vite/TypeScript build could not be completed because dependency installation timed out in the packaging environment.
- No production migration, Edge Function deployment, or Netlify deployment was performed in this session.
