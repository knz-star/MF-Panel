import { supabase } from '../lib/supabase';
import { httpsCallable, getFunctions } from '../lib/supabaseFunctionsCompat';
export type Unsubscribe = () => void;
const functions = getFunctions();
const call = <T, R>(name: string, data?: T) => httpsCallable<T, R>(functions, name)(data as T).then(result => result.data);
export interface PairingResult { code: string; requestId: string; expiresAt: number; expiresInSeconds: number }
export interface EvidenceRegistration { id?: string; userId: string; teamId: string; applicationId: string; status: string; activationStatus?: string; userVerified?: boolean; teamAuthorized?: boolean; deviceLabel?: string | null; linkedAt?: string | null; lastSeenAt?: string | null; revokedAt?: string | null }
function mapRegistration(row: any): EvidenceRegistration | null {
  return row ? { id: row.id, userId: row.user_id, teamId: row.team_id ?? '', applicationId: row.application_id, status: row.status, activationStatus: row.activation_status, userVerified: row.user_verified, teamAuthorized: row.team_authorized, deviceLabel: row.device_label, linkedAt: row.linked_at, lastSeenAt: row.last_seen_at, revokedAt: row.revoked_at } : null;
}
export const createPairing = () => call<Record<string, never>, PairingResult>('createEvidencePairing', {});
export const redeemPairing = (code: string, deviceLabel = 'Android device') => call<{code:string;deviceLabel:string},{success:boolean;registrationId:string;status:string}>('redeemEvidencePairing', { code, deviceLabel });
export const cancelPairing = (requestId: string) => call<{requestId:string}, {success:boolean}>('cancelEvidencePairing', { requestId });
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
