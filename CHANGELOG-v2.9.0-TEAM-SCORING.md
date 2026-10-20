# v2.9.0 — Team productivity scoring

- Replaced the main member score's completed/failed ratio with a productivity score based on real persisted workflow records.
- Added volume and speed/turnaround breakdown metadata.
- Searching score counts valid profile submissions in a rolling 24-hour window and observed submission cadence.
- Checking score counts completed checking records and assignment-to-check turnaround when timestamps are available.
- Excludes test data and avoids fabricating a score when no reliable activity exists.
- Live deployment and edge-function deployment are still required; this package does not change production automatically.
