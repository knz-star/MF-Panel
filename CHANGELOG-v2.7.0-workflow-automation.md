# v2.7.0 — Workflow automation and safe reset

- Simplified Searching intake to paste-and-process; new unique links automatically enter Checking.
- Added server-side duplicate/invalid routing into the Admin Review queue.
- Added automatic Checking → Evidence assignment queue handoff and blocked-result review items.
- Added senior-admin review controls and separate test-data/full-workflow reset operations.
- Added secured scheduled score evaluator for <25% auto-disable, with a separate cron secret.
- Android source unchanged; live Supabase deployment not performed from this package build.
