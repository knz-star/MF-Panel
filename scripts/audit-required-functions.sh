#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# Source-level check: every literal Edge Function invoked by the frontend must have source.
mapfile -t names < <(grep -RhoE "(functions\.invoke|invokeEdgeFunction(<[^>]+>)?)\(['\"][a-zA-Z0-9_-]+['\"]" src --include='*.ts' --include='*.tsx' | sed -E "s/.*\(['\"]([^'\"]+)['\"].*/\1/" | sort -u)
if ((${#names[@]} == 0)); then
  echo "ERROR: no literal Edge Function invokes found; review the source scan." >&2
  exit 1
fi
failed=0
for name in "${names[@]}"; do
  if [[ -f "supabase/functions/$name/index.ts" ]]; then
    printf 'OK   frontend invoke -> source exists: %s\n' "$name"
  else
    printf 'FAIL frontend invoke has no local function source: %s\n' "$name" >&2
    failed=1
  fi
done
# These endpoints are optional in fallback mode. Their source remains available for a
# future secured deployment, but the current website must not require them to build.
for optional in mfp-workflow-control mfp-admin-export-settings; do
  if [[ -f "supabase/functions/$optional/index.ts" ]]; then
    printf 'INFO optional endpoint source available (not required in fallback mode): %s\n' "$optional"
  fi
done
exit "$failed"
