# MF MPanel v2.8.3 — Required Edge Function deployment fix

## Why multiple pages fail

The frontend uses two separate Edge Functions:

- `mfp-team-analytics`: Profile score and Team Analytics requests.
- `mfp-workflow-control`: System Reset, reset preview, workflow ingestion and workflow handoff requests.

The live Supabase function inventory checked on 2026-10-19 did not list either function. Deploying only the website bundle cannot create these server endpoints. The analytics migration is already present in migration history; do not re-run it just to deploy a function.

## Deploy both required functions

From the extracted project root, using the Supabase account that owns project `nvzvyzgantmtwjfnrqdo`:

```bash
supabase login
supabase functions deploy mfp-team-analytics --project-ref nvzvyzgantmtwjfnrqdo
supabase functions deploy mfp-workflow-control --project-ref nvzvyzgantmtwjfnrqdo
```

Or run `bash scripts/deploy-required-functions.sh`. The helper deploys only these two functions; it does not run migrations and does not modify Android source.

## Safe score behavior

The included `mfp-team-analytics` function creates low-score warnings and notifications for review. It does not automatically disable a member or revoke app access because of a low score. A manager can still make a deliberate manual decision from the review action.

## Verify

1. Open https://supabase.com/dashboard/project/nvzvyzgantmtwjfnrqdo/functions and confirm both functions are listed and `ACTIVE`.
2. Sign in and test Profile score and Admin > Team Analytics.
3. Test System Reset preview first. Do not run an actual reset unless you intend to perform the destructive operation.
4. If an endpoint still fails, inspect browser DevTools → Network and the matching Supabase Function logs. A 401 indicates authentication/session; 403 authorization; 500 function/schema/runtime.

## Security

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side. Do not disable JWT verification as a workaround. No production deployment is claimed by this ZIP alone.
