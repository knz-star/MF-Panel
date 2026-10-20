# MF MPanel Team Scoring — v2.9.0

## Score inputs
- Searching Team: unique valid profile links created by that user, counted from persisted `mfp_documents` profile records, plus the observed submission cadence.
- Checking Team: completed checking records tied to the checker and their linked profile's assignment/creation timestamp, plus actual turnaround time.
- Test data and profiles without canonical URLs are excluded from productivity counts.
- No activity means `null` / “Not enough data”; cookies are not used to manufacture work scores.

## Formula
Initial configurable-by-source benchmark: 150 valid links per rolling 24 hours.
- Volume component = min(100, valid/completed links in the last 24h ÷ 150 × 100).
- Speed component = max(0, min(100, (24 − min(24, observed interval/average turnaround hours)) ÷ 24 × 100)).
- Overall score = 70% volume + 30% speed.

A 24h interval gives a lower speed component than a shorter interval, so a user submitting/checking comparable volume in 20h or 18h earns a better score. The UI's existing percentage display remains 0–100. Targets and weighting should be moved to admin-controlled settings after the team confirms its operational target.

## Important limitations
- This is source-code logic only; it does not affect the live site until the project is built and deployed and the `mfp-team-analytics` Edge Function is deployed.
- Historical records that lack actor IDs, canonical URLs, `profileId`, `queueAssignedAt`, or timestamps cannot be scored reliably.
- Team Analytics currently uses one general score field for all teams. Before using it for disciplinary action, test with real anonymized sample records and review the score breakdown.
- Cookie analytics remains separate and privacy-limited.
