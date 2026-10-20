# v2.8.5 release notes

This release fixes the underlying multi-team authorization mismatch and improves the separate workspace experience. It also removes manual handoff from Searching and makes valid unique-link routing automatic. The admin user list is based on canonical Supabase authorization records so the assigned teams shown in the admin panel match what Edge Functions enforce.

Deploy the two required Edge Functions with `bash scripts/deploy-required-functions.sh` after authenticating the Supabase CLI. Validate: (1) one user assigned Searching + Checking + Reports + Evidence, (2) switch into each workspace and verify its distinct title/navigation, (3) paste a small test batch and confirm unique links reach Checking while duplicates/invalids appear in Admin Review, (4) verify Searching shows counts only.
