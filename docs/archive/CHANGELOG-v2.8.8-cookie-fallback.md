# MF MPanel v2.8.8 — Cookie analytics and safe fallback

- Added opt-in first-party cookie counters for analytics-page views and manual health checks. Cookies contain only coarse local counters; no user IDs, emails, submitted URLs, or evidence data.
- System Health now distinguishes PASS, FALLBACK, and FAIL. Missing optional functions are presented as fallback rather than misleading generic red errors when the response indicates an unavailable endpoint.
- Workflow Review can still show review queue records if the reset-preview endpoint is unavailable. Reset actions are disabled until the server-side authorization/preview endpoint is restored; no unsafe client-side reset was added.
- Deployment helper no longer deploys missing optional functions automatically. It verifies the two existing Evidence endpoints only.

## Important limitations

Cookie analytics is browser-local and is not server-side team analytics. Live team scores, privileged team-admin assignment/review, bulk link ingestion, reset, and export-setting writes still require their secured server endpoints. The website source has been updated, but this ZIP does not change Netlify production or deploy Supabase functions automatically.
