# MF MPanel v2.10.0 implementation notes

## Included source changes
- Evidence workspace navigation is reduced to Evidence Pairing and Assign Links; legacy evidence dashboard URLs redirect to pairing. Android app source is untouched.
- Assign Links shows platform availability, lets a member request 1–2000 links and downloads a TXT file. The database reserves links before the browser download starts.
- ZIP upload analysis reconciles extracted URLs only against pending assignments belonging to the signed-in user. Matches are marked RECEIVED; unknown URLs are not auto-verified.
- Checking workspace is reduced to one current task. A server-side batch claim reserves up to ten unique links for one checker; other users do not see the batch or queue totals. Statuses are Open, Reopen, Recheck, Blocked, Invalid and Verified.
- Verified allows either no post URLs or exactly three; partial post lists are rejected. Blocked/Invalid require a note. Admin-only checking results are added.
- Searching/Checking score formula changes from v2.9.0 are retained; Evidence outcome score is preserved.

## Required deployment steps
1. Apply `supabase/migrations/20261020093000_mfp_assign_links_zip_receipts_private_checking.sql` in the target Supabase project. Review it first; it creates new `mfp_*` tables and functions only.
2. Deploy `supabase/functions/mfp-link-workflow/index.ts` as Edge Function `mfp-link-workflow` with JWT verification enabled.
3. Deploy the website ZIP to Netlify.
4. Test with two checking accounts: confirm a claimed profile cannot be claimed by the other account, verify each terminal status, and confirm a ZIP uploaded by the assignee marks only their matching assigned links RECEIVED.

## Limitations / caution
- Source code and migration are not live-deployed by creating this ZIP.
- The checking batch claim excludes any profile already present in `mfp_checking_assignments`, intentionally preventing duplicate reassignment. An admin workflow for explicitly returning a link to the queue must be used for corrections.
- ZIP matching normalizes URLs and chunks up to 500 distinct URLs per database lookup. Large archives are still subject to the Edge Function runtime limit.
- The SQL functions use service-role-only grants and are called by the authenticated Edge Function; never grant direct execution to browser roles.
- Full production build and live Supabase tests are still required.
