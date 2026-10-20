/** Privacy-first, first-party browser analytics fallback.
 * Stores only coarse page/action counters in a short-lived cookie after explicit opt-in.
 * Never stores email, user ID, URL query strings, link contents, or evidence data.
 * This is browser-local usage telemetry, not a substitute for server-side team metrics.
 */
const CONSENT = 'mfp_analytics_consent';
const EVENTS = 'mfp_usage_v1';
const MAX_AGE = 60 * 60 * 24 * 30;
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const item = document.cookie.split('; ').find(part => part.startsWith(prefix));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(prefix.length)); } catch { return null; }
}
function writeCookie(name: string, value: string, maxAge = MAX_AGE) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
}
export function hasAnalyticsConsent(): boolean { return readCookie(CONSENT) === 'yes'; }
export function setAnalyticsConsent(enabled: boolean) {
  writeCookie(CONSENT, enabled ? 'yes' : 'no');
  if (!enabled) writeCookie(EVENTS, '', 0);
}
export function trackUsageEvent(event: 'analytics_view' | 'health_check' | 'manual_refresh') {
  if (!hasAnalyticsConsent()) return;
  let data: Record<string, number> = {};
  try { data = JSON.parse(readCookie(EVENTS) || '{}') as Record<string, number>; } catch { data = {}; }
  const key = event;
  data[key] = Math.min(100000, (Number(data[key]) || 0) + 1);
  writeCookie(EVENTS, JSON.stringify(data));
}
export function getCookieUsageSummary(): Record<string, number> {
  if (!hasAnalyticsConsent()) return {};
  try { return JSON.parse(readCookie(EVENTS) || '{}') as Record<string, number>; } catch { return {}; }
}
