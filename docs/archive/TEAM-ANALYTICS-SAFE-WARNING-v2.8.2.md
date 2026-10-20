# MF MPanel v2.8.2 — Team Analytics safe warning-only behavior

## Change
- Low scores below 25% create a `PENDING_REVIEW` warning and notify the relevant administrators.
- Low scores do not automatically update `mfp_user_profiles.account_status`, `mfp_documents` account status, Evidence registration status, or user sessions.
- Administrators may still make an explicit decision from the Team Analytics review workflow; that manual action is separate from automatic score evaluation.
- Android source is unchanged. No database migration is needed for this code-only behavior change.

## Deploy
From this project root, with the Supabase CLI authenticated to the project:

```bash
supabase functions deploy mfp-team-analytics --project-ref nvzvyzgantmtwjfnrqdo
```

## Verify
1. Confirm `mfp-team-analytics` is ACTIVE in the Supabase dashboard.
2. Sign in as an authorized admin and open Team Analytics.
3. Inspect the Network request to `functions/v1/mfp-team-analytics`; expect an authenticated successful response, not a fetch failure.
4. Confirm a low-score member receives a review warning but remains ACTIVE unless an administrator explicitly changes the account status.
5. Review Edge Function logs for database schema or authorization errors.

This ZIP alone does not deploy to production. Do not report the live fix complete until the function is deployed and the authenticated request has been tested.
