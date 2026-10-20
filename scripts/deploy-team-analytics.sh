#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="nvzvyzgantmtwjfnrqdo"
FUNCTION_NAME="mfp-team-analytics"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install it from https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "Deploying ${FUNCTION_NAME} to Supabase project ${PROJECT_REF}..."
echo "This deploys only the Edge Function; it does not run database migrations."
supabase functions deploy "${FUNCTION_NAME}" --project-ref "${PROJECT_REF}"
echo
echo "Deployment command completed. Verify the function is ACTIVE in Supabase Dashboard,"
echo "then sign in to MF MPanel and test Admin > Team Analytics."
