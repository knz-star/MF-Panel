#!/usr/bin/env bash
set -euo pipefail
PROJECT_REF="nvzvyzgantmtwjfnrqdo"
# Deploy authenticated workflow/report functions and the Team Admin analytics endpoint.
# Apply the included SQL migrations in order before deploying these functions.
VERIFY=(mfp-evidence-performance mfp-evidence-linking)
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install it from https://supabase.com/docs/guides/cli" >&2
  exit 1
fi
if ! supabase projects list >/dev/null 2>&1; then
  echo "Supabase CLI is not authenticated. Run: supabase login" >&2
  exit 1
fi
supabase functions deploy mfp-link-workflow --project-ref "$PROJECT_REF"
supabase functions deploy mfp-organization-reports --project-ref "$PROJECT_REF"
supabase functions deploy mfp-gender-team-admin --project-ref "$PROJECT_REF"
supabase functions deploy mfp-team-analytics --project-ref "$PROJECT_REF"
list_output="$(supabase functions list --project-ref "$PROJECT_REF")"
printf '%s\n' "$list_output"
for function_name in "${VERIFY[@]}"; do
  if ! grep -Fq "$function_name" <<< "$list_output"; then
    echo "ERROR: expected existing function $function_name was not found." >&2
    exit 1
  fi
done
for function_name in mfp-link-workflow mfp-organization-reports mfp-gender-team-admin mfp-team-analytics; do
  if ! grep -Fq "$function_name" <<< "$list_output"; then echo "ERROR: $function_name deployment not visible in function inventory." >&2; exit 1; fi
done
echo "PASS: link workflow, organization reports, gender-team dashboard and Team Admin analytics are deployed; existing Evidence endpoints are present."
