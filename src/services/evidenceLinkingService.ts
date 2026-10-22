import { supabase } from '../lib/supabase';
import { invokeWebsiteApi } from './webApiClient';
export type Unsubscribe = () => void;
const actionMap: Record<string,string> = { createEvidencePairing:'createPairing', cancelEvidencePairing:'cancelPairing', disconnectEvidenceApp:'disconnect', getEvidenceDashboardSummary:'getSummary', getEvidenceLinksPage:'getLinksPage', recordEvidenceLinksDownload:'recordDownload', listEvidenceConnectionsForAdmin:'listAdmin', redeemEvidencePairing:'redeemPairing' };
const call = <T, R>(name: string, data?: T) => invokeWebsiteApi<R>('mfp-evidence-linking', { action: actionMap[name] ?? name, ...((data as any) ?? {}) });
export interface PairingResult { code: string; requestId: string; expiresAt: number; expiresInSeconds: number }
export interface EvidenceRegistration { id?: string; userId: string; teamId: string; applicationId: string; status: string; activationStatus?: string; userVerified?: boolean; teamAuthorized?: boolean; deviceLabel?: string | null; linkedAt?: string | null; lastSeenAt?: string | null; revokedAt?: string | null }
function mapRegistration(row: any): EvidenceRegistration | null {
  return row ? { id: row.id, userId: row.user_id, teamId: row.team_id ?? '', applicationId: row.application_id, status: row.status, activationStatus: row.activation_status, userVerified: row.user_verified, teamAuthorized: row.team_authorized, deviceLabel: row.device_label, linkedAt: row.linked_at, lastSeenAt: row.last_seen_at, revokedAt: row.revoked_at } : null;
}
/**
 * Creates a pairing code and mirrors it into the legacy table the installed Android app validates against.
 * If the mirror step fails, the new request is cancelled so the user never sees a code the app would reject as invalid.
 */
export async function createPairing(): Promise<PairingResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await call<Record<string, never>, PairingResult>('createEvidencePairing', {});
    const { error } = await supabase.rpc('mfp_sync_legacy_pairing_code', { p_request_id: result.requestId, p_code: result.code, p_action: 'create' });
    if (!error) return result;
    lastError = error;
    await call<{ requestId: string }, { success: boolean }>('cancelEvidencePairing', { requestId: result.requestId }).catch(() => undefined);
    if (!/collision/i.test(error.message || '')) break;
  }
  console.error('Legacy pairing mirror failed', lastError);
  throw new Error('Pairing code could not be prepared for the Evidence app. Please try again in a moment.');
}
export const redeemPairing = (code: string, deviceLabel = 'Android device') => call<{code:string;deviceLabel:string},{success:boolean;registrationId:string;status:string}>('redeemEvidencePairing', { code, deviceLabel });
export const cancelPairing = (requestId: string, code?: string) => {
  if (code) void supabase.rpc('mfp_sync_legacy_pairing_code', { p_request_id: requestId, p_code: code, p_action: 'cancel' }).then(({ error }) => { if (error) console.warn('Legacy pairing cancel failed', error.message); });
  return call<{requestId:string}, {success:boolean}>('cancelEvidencePairing', { requestId });
};
export const disconnectEvidence = (userId?: string) => call<{userId?:string}, {success:boolean}>('disconnectEvidenceApp', userId ? {userId} : {});
export function watchEvidenceRegistration(uid: string, callback: (registration: EvidenceRegistration | null) => void, onError: (error: Error) => void): Unsubscribe {
  let active = true;
  const refresh = async () => {
    const { data, error } = await supabase.from('mfp_evidence_app_registrations').select('*').eq('user_id', uid).eq('application_id', 'MF_EVIDENCE').order('linked_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (active) callback(mapRegistration(data));
  };
  void refresh().catch((e) => onError(e instanceof Error ? e : new Error(String(e))));
  const channel = supabase.channel(`mfp-evidence-registration-${uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mfp_evidence_app_registrations', filter: `user_id=eq.${uid}` }, () => { void refresh().catch((e) => onError(e instanceof Error ? e : new Error(String(e)))); }).subscribe((status) => { if (status === 'CHANNEL_ERROR' && active) onError(new Error('Realtime subscription failed for Evidence registration.')); });
  return () => { active = false; void supabase.removeChannel(channel); };
}
export const evidenceRegistrationRef = (id: string) => id;
export interface EvidenceDashboardSummary { active: boolean; totalProfiles: number | null; platformCounts: Record<string, number>; teamId: string | null; lastSync: number | null }
export const getEvidenceDashboardSummary = () => call<Record<string, never>, EvidenceDashboardSummary>('getEvidenceDashboardSummary', {});
export interface EvidenceLinkRecord { id: string; profileId: string; url: string; platform: string; status: string }
export interface EvidenceLinksPage { links: EvidenceLinkRecord[]; nextCursor: string | null; total: number }
export const getEvidenceLinksPage = (cursor: string | null) => call<{cursor: string | null}, EvidenceLinksPage>('getEvidenceLinksPage', { cursor });
export const recordEvidenceLinksDownload = (count: number, platforms: Record<string, number>) => call<{ count: number; platforms: Record<string, number> }, { success: boolean }>('recordEvidenceLinksDownload', { count, platforms });
