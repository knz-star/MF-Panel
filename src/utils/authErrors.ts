/** Maps Supabase Auth / network errors to short, safe, actionable messages (Roman Urdu). Raw details go to the console only. */
export type AuthErrorContext = 'login' | 'signup' | 'reset' | 'update-password' | 'resend' | 'generic';

const supportRef = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export function authErrorMessage(err: unknown, context: AuthErrorContext = 'generic'): string {
  const e = (err ?? {}) as { code?: string; status?: number; name?: string; message?: string };
  const code = String(e.code ?? '').toLowerCase();
  const message = String(e.message ?? '');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'Apna email verify karein. Agar email nahi mili, to verification email dobara bhejein.';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'Email ya password check karein aur dobara try karein.';
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message) || e.name === 'AuthRetryableFetchError' || e.status === 0) return 'Connection issue hai. Internet check karke dobara try karein.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || code === 'too_many_requests' || e.status === 429 || /rate limit|too many/i.test(message)) return 'Bohat zyada attempts hue hain. Kuch der baad dobara try karein.';
  if (code === 'weak_password' || /password should be at least|weak password/i.test(message)) return 'Password kam az kam 6 characters ka hona chahiye.';
  if (code === 'same_password') return 'Naya password purane password se mukhtalif hona chahiye.';
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found' || /expired|invalid.*(token|link)/i.test(message) && context !== 'login') return 'Yeh link expire ho chuka hai ya pehle use ho chuka hai. Naya link mangwayein.';
  if (code === 'session_expired' || code === 'session_not_found' || code === 'refresh_token_not_found' || /jwt expired|session.*(expired|missing)/i.test(message)) return 'Aapka session expire ho gaya hai. Dobara sign in karein.';
  if (code === 'validation_failed' || code === 'email_address_invalid' || code === 'invalid_email') return 'Email address valid nahi hai.';
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'Naye accounts filhal band hain. Administrator se rabta karein.';
  if (code === '42501' || code === 'permission-denied' || e.status === 403) return 'Aapko is action ki permission nahi hai.';
  const ref = supportRef();
  console.error(`[auth:${context}] unexpected error (ref ${ref})`, err);
  return `Service filhal available nahi hai. Kuch der baad dobara try karein. (Ref: ${ref})`;
}
