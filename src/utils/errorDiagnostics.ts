export type ErrorSource = 'FRONTEND' | 'BACKEND_EDGE_FUNCTIONS' | 'BACKEND_DATABASE' | 'SUPABASE_AUTH' | 'NETWORK' | 'UNKNOWN';

export interface ErrorDiagnostic {
  source: ErrorSource;
  title: string;
  code: string;
  message: string;
  nextStep: string;
}

export function diagnoseError(error: unknown): ErrorDiagnostic {
  const value = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown; name?: unknown } : {};
  const code = typeof value.code === 'string' ? value.code : '';
  const message = typeof value.message === 'string' ? value.message : typeof error === 'string' ? error : 'Unknown error';
  const lower = `${code} ${message}`.toLowerCase();
  if (code.startsWith('functions/') || /cloud function|callable function|function execution|edge function|failed to send a request to the edge function|could not be reached|function not found|failed to invoke/.test(lower)) {
    const functionName = lower.includes('mfp-team-analytics') ? 'mfp-team-analytics' : lower.includes('mfp-workflow-control') ? 'mfp-workflow-control' : lower.includes('mfp-evidence-performance') ? 'mfp-evidence-performance' : lower.includes('mfp-evidence-linking') ? 'mfp-evidence-linking' : null;
    const target = functionName ? `Function: ${functionName}. ` : '';
    return { source: 'BACKEND_EDGE_FUNCTIONS', title: 'Old website bundle is calling a legacy endpoint', code: code || 'supabase/legacy-edge-call', message, nextStep: `${target}Current MF MPanel v2.13.0 website source uses database RPCs, not browser Edge Function calls. Confirm the latest Netlify build is deployed, clear the browser cache, and apply the database migrations through 20261020133000_mfp_web_rpc_replacements.sql. Keep the already-deployed Android pairing bridge until the Android app is separately migrated.` };
  }
  if (code.startsWith('PGRST') || code.startsWith('42501') || ['permission-denied', 'failed-precondition', 'unavailable', 'deadline-exceeded', 'not-found'].includes(code) || /postgres|supabase|row level security|security policies|missing or insufficient permissions/.test(lower)) {
    return { source: 'BACKEND_DATABASE', title: 'Backend / Supabase database / RLS error', code: code || 'supabase/database-error', message, nextStep: 'Supabase SQL/RLS policies, mfp_documents permissions, project URL aur authenticated session verify karein.' };
  }
  if (code.startsWith('auth/') || /invalid api key|api-key-not-valid|supabase auth|invalid_credentials|email_not_confirmed|provider-disabled/.test(lower)) {
    return { source: 'SUPABASE_AUTH', title: 'Supabase Auth / project configuration error', code: code || 'auth/unknown', message, nextStep: 'Supabase Dashboard → Authentication → Providers, redirect URLs aur publishable key check karein.' };
  }
  if (/network|offline|internet|fetch failed|connection|timeout|timed out/.test(lower)) {
    return { source: 'NETWORK', title: 'Network / Supabase connectivity error', code: code || 'network/unknown', message, nextStep: 'Internet connection, Supabase project availability, browser network requests aur blocked domains check karein.' };
  }
  if (/chunkloaderror|failed to fetch dynamically imported module|rendering error|react error|cannot read properties/.test(lower) || value.name === 'TypeError' || value.name === 'SyntaxError') {
    return { source: 'FRONTEND', title: 'Frontend / JavaScript error', code: code || (typeof value.name === 'string' ? value.name : 'frontend/runtime'), message, nextStep: 'Browser Console mein stack trace dekhein; frontend source fix karke naya production build deploy karein.' };
  }
  return { source: 'UNKNOWN', title: 'Source not confirmed', code: code || 'unknown', message, nextStep: 'Yeh error akela frontend ya backend ko conclusively identify nahi karta. Browser Console aur Supabase database operation/Postgres/Auth logs ka same-time entry compare karein.' };
}
