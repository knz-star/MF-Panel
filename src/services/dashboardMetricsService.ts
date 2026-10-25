import { supabase } from '../lib/supabase';

export interface DashboardDailyMetric {
  date: string;
  searchingProfiles: number;
  searchingPosts: number;
  searchingTotal: number;
  searchingUsers: number;
  checkingAssigned: number;
  checkingChecked: number;
  checkingVerified: number;
  checkingFailed: number;
  evidenceAssigned: number;
  evidenceCompleted: number;
  reportsCountedSeparately: false;
}
export interface DashboardMetrics {
  generatedAt: string;
  days: number;
  totals: {
    profiles: number; posts: number; totalLinks: number; activeUsers: number;
    checkingAssigned: number; checkingChecked: number; checkingVerified: number; checkingFailed: number;
    evidenceAssigned: number; evidenceCompleted: number; reportsCountedSeparately: false;
  };
  daily: DashboardDailyMetric[];
}
export async function getDashboardMetrics(days = 7): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc('mfp_team_operational_metrics', { p_days: days });
  if (error) throw new Error(error.message);
  return data as DashboardMetrics;
}
export interface TrackerRecord {
  kind: 'profile' | 'post'; id: string; publicId: string; profileId: string | null; url: string;
  platform: string; status: string; createdAt: string; updatedAt: string;
  timeline: Array<{ stage: string; action: string; previousStatus: string | null; newStatus: string | null; createdAt: string; actor: string | null; metadata: Record<string, unknown> }>;
}
export async function lookupTracker(query: string, isPublic = false): Promise<{ query: string; generatedAt: string; public: boolean; records: TrackerRecord[] }> {
  const { data, error } = await supabase.rpc('mfp_global_tracker_lookup', { p_query: query, p_public: isPublic });
  if (error) throw new Error(error.message);
  return data as { query: string; generatedAt: string; public: boolean; records: TrackerRecord[] };
}
export interface TeamWhatsApp { team_key: string; whatsapp_number: string; updated_at?: string }
export async function getTeamWhatsApp(): Promise<TeamWhatsApp[]> {
  const { data, error } = await supabase.rpc('mfp_team_whatsapp', { p_action: 'read', p_team: null, p_whatsapp_number: null });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data as TeamWhatsApp[] : [data as TeamWhatsApp];
}
export async function saveTeamWhatsApp(team: string, number: string): Promise<void> {
  const { error } = await supabase.rpc('mfp_team_whatsapp', { p_action: 'write', p_team: team, p_whatsapp_number: number });
  if (error) throw new Error(error.message);
}

export interface SearchingContributorMetric {
  userId: string | null;
  displayName: string;
  email: string | null;
  todayLinks: number;
  last7Days: number;
  totalLinks: number;
  lastLinkAt: string | null;
}
export async function getSearchingContributorMetrics(days = 7): Promise<SearchingContributorMetric[]> {
  const { data, error } = await supabase.rpc('mfp_searching_contributor_metrics', { p_days: days });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data as SearchingContributorMetric[] : [];
}
