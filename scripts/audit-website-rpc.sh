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
if grep -R -n "mfp_select_team\|selectTeam\|/select-team\|TeamSelectionPage" src --exclude-dir=tests; then
  echo "Obsolete team-selection flow remains in website source" >&2
  exit 1
fi
MIGRATION="supabase/migrations/20261020133000_mfp_web_rpc_replacements.sql"
for legacy_policy in 'MFP users read permitted documents' 'mfp_documents_select_access' 'MFP users update own non-public documents' 'mfp_documents_update_access' 'MFP users delete own non-public documents' 'mfp_documents_delete_access' 'MFP users create own non-public documents' 'mfp_documents_insert_access'; do
  if ! grep -Fq "drop policy if exists \"${legacy_policy}\" on public.mfp_documents" "$MIGRATION" && ! grep -Fq "drop policy if exists ${legacy_policy} on public.mfp_documents" "$MIGRATION"; then
    echo "FAIL: legacy permissive policy is not removed: ${legacy_policy}" >&2
    exit 1
  fi
done
if ! grep -q "Administrator access required'; end if;" "$MIGRATION" || ! grep -q "action='getAdminPerformance' and not admin_ok" "$MIGRATION"; then
  echo "FAIL: admin performance RPC permission guard is missing." >&2
  exit 1
fi
if ! grep -Fq "collection_name='profiles' and team_key='searching' and (select mfp_private.current_team())='checking'" "$MIGRATION"; then
  echo "FAIL: checking users are not constrained to assigned Searching-team source profiles." >&2
  exit 1
fi
if ! grep -q "security definer set search_path=public,extensions,auth,pg_temp" "$MIGRATION"; then
  echo "FAIL: mfp_web_api search_path must include the extensions schema (pgcrypto digest/gen_random_bytes)." >&2
  exit 1
fi
if grep -q "'zip_password',v->>'zip_password'" "$MIGRATION" || grep -rn "data?.zip_password" src --include=*.tsx >/dev/null; then
  echo "FAIL: the ZIP export password must never be returned to the browser." >&2
  exit 1
fi
if ! grep -rq "mfp_web_notifications" supabase/migrations/20261020140000_mfp_backend_hardening.sql; then
  echo "FAIL: mfp_web_notifications table is not created by a migration." >&2
  exit 1
fi
echo "PASS: website uses database RPCs and conflicting legacy RLS policies are removed."
echo "INFO: mobile-compat/mfp-evidence-linking is reference source for the existing Android bridge only."
