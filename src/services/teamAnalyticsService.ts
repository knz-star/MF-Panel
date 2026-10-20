import { invokeEdgeFunction } from './edgeFunctionClient';

export type ManagedTeam = 'searching' | 'checking' | 'reports' | 'evidence';
export interface TeamMemberMetric {
  userId: string; name: string; email: string; team: ManagedTeam; score: number | null;
  status: string; assigned: number; completed: number; failed: number; activity: number;
  scoreDetails?: { volumeScore:number; speedScore:number; linksLast24h:number; avgTurnaroundHours:number|null; latestActivityAt:string|null };
  daily: Array<{ date: string; completed: number; failed: number; activity: number }>;
  lowScorePending: boolean;
}
export interface TeamAnalyticsData {
  isSeniorAdmin: boolean; managedTeams: ManagedTeam[]; teams: Array<{ team: ManagedTeam; adminName: string | null; score: number | null; adminScore: number | null; members: number; activity: number; daily: Array<{date:string;score:number|null;activity:number}> }>;
  members: TeamMemberMetric[]; trendWarnings: Array<{team:ManagedTeam;createdAt:string;scores:Array<{date:string;score:number}>}>; warnings: Array<{ id: string; userId: string; name: string; team: ManagedTeam; score: number; createdAt: string; status: string }>;
  admins: Array<{ userId: string; name: string; email: string }>;
}
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return invokeEdgeFunction<T>('mfp-team-analytics', { action, ...payload });
}
export const getTeamAnalytics = (days: 7 | 14) => call<TeamAnalyticsData>('getAnalytics', { days });
export const assignTeamAdmin = (team: ManagedTeam, userId: string | null) => call<{success:boolean}>('assignTeamAdmin', { team, userId });
export const reviewLowScore = (warningId: string, decision: 'keep' | 'remove') => call<{success:boolean}>('reviewLowScore', { warningId, decision });
export interface MyTeamScore { userId:string; name:string; team:string; score:number|null; scoreStatus:string; accountStatus:string; activity:number; completed:number; failed:number; daily:Array<{date:string;completed:number;failed:number;activity:number}>; days:number }
export const getMyTeamScore = (days: 7 | 14) => call<MyTeamScore>('getMyScore', { days });
