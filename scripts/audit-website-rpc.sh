#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if grep -RInE 'supabase\.functions\.invoke|httpsCallable\(|functions\/v1\/' src --exclude-dir=tests --include='*.ts' --include='*.tsx'; then
  echo "FAIL: website source still calls a Supabase Edge Function." >&2
  exit 1
fi
if ! grep -q "mfp_web_api" supabase/migrations/20261020133000_mfp_web_rpc_replacements.sql; then
  echo "FAIL: database RPC replacement migration is missing." >&2
  exit 1
fi
if ! grep -q "mfp_select_team" supabase/migrations/20261020133000_mfp_web_rpc_replacements.sql; then
  echo "FAIL: secure team-switch RPC is missing." >&2
  exit 1
fi
echo "PASS: website source uses database RPCs; no Edge Function invocations found."
echo "INFO: mobile-compat/mfp-evidence-linking is reference source for the existing Android bridge only."
