import { invokeWebsiteApi } from './webApiClient';
import type { ExtractedBatchItem } from '../utils/urlExtractor';
import { supabase } from '../lib/supabase';

export interface IntakeResult { success: boolean; created: number; queued?: number; backlogged?: number; duplicates: number; invalid: number; profileLinks?: number; postedLinks?: number; submittedCount?: number; message: string; profileIds?: string[]; reviewIds?: string[] }
export interface ResetPreview { success: boolean; testingRecords: number; workflowRecords: number; byCollection: Record<string, number>; resetScope: string }
async function invoke<T>(payload: Record<string, unknown>): Promise<T> {
  return invokeWebsiteApi<T>('mfp-workflow-control', payload);
}
export async function autoIngestLinks(items: ExtractedBatchItem[], isTestData = false): Promise<IntakeResult> {
  const payload = items.map(item => ({ rawUrl: item.extractedUrl, canonicalUrl: item.normalized.normalizedUrl, platform: item.normalized.platform, urlType: item.normalized.urlType, error: item.normalized.error ?? '', notes: item.senderInfo ? `Source: ${item.senderInfo}` : '' }));
  const { data, error } = await supabase.rpc('mfp_ingest_links', { p_items: payload, p_is_test_data: isTestData });
  if (error) throw new Error(error.message);
  return data as IntakeResult;
}
export const previewWorkflowReset = () => invoke<ResetPreview>({ action: 'resetPreview' });
export const resetTestingData = () => invoke<{success:boolean;deleted:number}>({ action: 'resetTestingData', confirmation: 'DELETE TEST DATA' });
export const resetWorkflowData = () => invoke<{success:boolean;deleted:number}>({ action: 'resetSystem', confirmation: 'RESET ALL MF MPANEL DATA' });

export const createCheckingHandoff = (profileId: string, outcome: 'VERIFIED' | 'FAILED_BLOCKED', checkingRecordId: string, notes = '') => invoke<{success:boolean;id:string;status:string}>({ action: 'checkingHandoff', profileId, outcome, checkingRecordId, notes });

export const claimEvidenceAssignment = (assignmentId: string) => invoke<{success:boolean;assignmentId:string;status:string;assignedTo:string}>({ action: 'claimEvidenceAssignment', assignmentId });
