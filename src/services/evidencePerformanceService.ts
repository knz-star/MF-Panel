import { invokeEdgeFunction } from './edgeFunctionClient';

export type EvidencePeriod = 'daily' | 'weekly' | 'days7' | 'days14' | 'monthly' | 'days90';
export interface EvidencePerformance {
  userId: string;
  email?: string;
  displayName?: string;
  period: EvidencePeriod;
  rangeStart: string;
  assigned: number;
  completed: number;
  failed: number;
  pending: number;
  activeAssigned: number;
  score: number | null;
  scoreStatus: 'NO_OUTCOMES' | 'BELOW_THRESHOLD' | 'NEEDS_IMPROVEMENT' | 'ON_TRACK';
  platformCounts: Record<string, { assigned: number; completed: number; pending: number; returned: number }>;
  series: Array<{ date: string; assigned: number; completed: number; failed: number }>;
  registrationStatus: string;
  activationStatus: string;
  lastSeenAt: string | null;
}
export interface AdminEvidencePerformance {
  period: EvidencePeriod;
  users: Array<EvidencePerformance & { accountStatus: string; team: string }>;
  totals: { users: number; assigned: number; completed: number; pending: number };
}

async function invoke<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return invokeEdgeFunction<T>('mfp-evidence-performance', { action, ...payload });
}

export const getEvidencePerformance = (period: EvidencePeriod) => invoke<EvidencePerformance>('getPerformance', { period });
export const getAdminEvidencePerformance = (period: EvidencePeriod) => invoke<AdminEvidencePerformance>('getAdminPerformance', { period });
export interface EvidenceActivityInput {
  eventType: 'ASSIGNED' | 'OPENED' | 'PENDING' | 'COMPLETED' | 'FAILED';
  linkId: string;
  profileId?: string;
  url?: string;
  platform?: string;
  batchId?: string;
  metadata?: Record<string, unknown>;
}
export const syncEvidenceActivity = (events: EvidenceActivityInput[]) => invoke<{ success: boolean; saved: number; autoRevoked: boolean; message: string; performance: EvidencePerformance }>('syncWorkActivity', { events });
