import { supabase } from '../lib/supabase';

/** Website backend: authenticated Postgres RPC; no browser Edge Function calls. */
export async function invokeWebsiteApi<T>(service: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc('mfp_web_api', { p_service: service, p_payload: body });
  if (error) {
    const message = error.message || 'The database operation could not be completed.';
    if (/jwt|auth|session/i.test(message)) throw new Error('Your session has expired. Please sign in again.');
    if (/permission|administrator|access required|not assigned/i.test(message)) throw new Error(message);
    throw new Error(message);
  }
  if (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
    throw new Error(String((data as Record<string, unknown>).error));
  }
  return data as T;
}
