# MF MPanel Evidence Performance — v2.3.1

## Website routes
- `/dashboard/evidence-performance` — Evidence user analytics.
- `/admin/evidence-performance` — admin team-wide analytics.
- `/dashboard/evidence-linking` — pairing and connection management.
- Evidence team login now redirects to `/dashboard/evidence-performance`, where app status, assigned/completed/pending totals, platform breakdown, and score history appear.

## Backend
- `mfp_evidence_work_items` stores the current owner/status of each evidence link. Returning a link sets it to `AVAILABLE`; completed/failure details remain in immutable activity events.
- `mfp_evidence_activity_events` records assignment, open, pending, completed, failed, automatic return and access-revocation events.
- `mfp_evidence_score_snapshots` stores rolling 30-day score decisions.
- `mfp-evidence-performance` requires an authenticated Supabase session and validates the user/team or ADMIN role server-side. These tables have RLS enabled and intentionally have no direct browser policies; the Edge Function uses the service role.

## Android integration contract
The Android app must call `mfp-evidence-performance` with an authenticated session and JSON body:

```json
{
  "action": "syncWorkActivity",
  "events": [
    { "eventType": "ASSIGNED", "linkId": "MDF-123", "profileId": "MDF-123", "url": "https://example.com/profile", "platform": "Instagram", "batchId": "BATCH-01" },
    { "eventType": "OPENED", "linkId": "MDF-123", "platform": "Instagram" },
    { "eventType": "COMPLETED", "linkId": "MDF-123", "platform": "Instagram", "metadata": { "screenshots": 3 } }
  ]
}
```

Allowed `eventType` values: `ASSIGNED`, `OPENED`, `PENDING`, `COMPLETED`, `FAILED`. Submit in batches of up to 500 events. Non-assignment events are accepted only for links currently assigned to the signed-in user. The app must handle `autoRevoked: true` by clearing local credentials/session and returning to the login screen.

## Score policy
- Score = latest completed outcomes / (latest completed + failed outcomes) × 100 in the rolling 30-day window.
- Pending work by itself does not lower the score. This avoids auto-removing a user just because newly assigned work has not yet been completed.
- The automatic action triggers when at least one completed/failed outcome exists and the rolling 30-day score is below 25. The backend records a score snapshot, returns all currently assigned/pending/completed work items to the shared AVAILABLE pool, preserves the event history, revokes Evidence registration and invalidates global Supabase sessions.
- ADMIN accounts are excluded from automatic revocation.

## Important integration limitation
The website dashboard and Edge Function are ready to receive per-link work events. If the currently installed Android APK only downloads links and does not call `syncWorkActivity`, its completion/pending numbers will stay empty until the Android source is updated and a new APK is built. The Android project was not present in the website source ZIP, so this ZIP does not claim the APK is updated.

## Default administrator
The live `mfp_user_profiles` record for `knzbro602@gmail.com` was promoted to `ADMIN` and remains `ACTIVE`. The `mfp_ensure_profile()` function now also grants ADMIN to this exact email only after Supabase confirms the email, so future profile creation for the verified account keeps the intended bootstrap rule.
