import { ProfileRecord } from '../types/profile';
import { PostRecord } from '../types/post';
import { CheckingRecord } from '../types/checking';
import { WorkflowEvent, SystemSettings, AuditLog } from '../types/workflow';
import { UserProfile } from '../types/user';
import { ReportJob } from '../types/report';

const KEYS = {
  PROFILES: 'mf_profiles',
  POSTS: 'mf_posts',
  CHECKING_RECORDS: 'mf_checking_records',
  WORKFLOW_EVENTS: 'mf_workflow_events',
  SETTINGS: 'mf_system_settings',
  USERS: 'mf_users',
  REPORT_JOBS: 'mf_report_jobs',
  AUDIT_LOGS: 'mf_audit_logs',
};

const SEED_USERS: UserProfile[] = [];

const SEED_SETTINGS: SystemSettings = {
  checkingQueueCapacity: 500,
  retentionHours: 72,
  maxZipSizeBytes: 100 * 1024 * 1024,
  maxLinksPerFolderLimit: 500,
  updatedAt: new Date().toISOString(),
  updatedBy: 'usr_knz_bro502_gmail_com',
};

const SEED_PROFILES: ProfileRecord[] = [];

const SEED_POSTS: PostRecord[] = [];

const SEED_CHECKING_RECORDS: CheckingRecord[] = [];

const SEED_WORKFLOW_EVENTS: WorkflowEvent[] = [];

function readItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`Could not read ${key} from localStorage, using fallback:`, e);
    return defaultValue;
  }
}

function writeItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Could not write ${key} to localStorage:`, e);
  }
}

export const localStore = {
  /** Wipe the browser cache so another account on a shared device never sees previous records. */
  clearAll: (): void => {
    try { Object.values(KEYS).forEach((k) => localStorage.removeItem(k)); } catch (e) { console.warn('Could not clear local cache:', e); }
  },
  getProfiles: (): ProfileRecord[] => readItem<ProfileRecord[]>(KEYS.PROFILES, SEED_PROFILES),
  saveProfiles: (profiles: ProfileRecord[]) => writeItem(KEYS.PROFILES, profiles),
  upsertProfile: (profile: ProfileRecord): ProfileRecord => {
    const list = localStore.getProfiles();
    const idx = list.findIndex((p) => p.profileId === profile.profileId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...profile, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(profile);
    }
    localStore.saveProfiles(list);
    return profile;
  },

  getPosts: (): PostRecord[] => readItem<PostRecord[]>(KEYS.POSTS, SEED_POSTS),
  savePosts: (posts: PostRecord[]) => writeItem(KEYS.POSTS, posts),
  upsertPost: (post: PostRecord): PostRecord => {
    const list = localStore.getPosts();
    const idx = list.findIndex((p) => p.postId === post.postId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...post, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(post);
    }
    localStore.savePosts(list);
    return post;
  },

  getCheckingRecords: (): CheckingRecord[] =>
    readItem<CheckingRecord[]>(KEYS.CHECKING_RECORDS, SEED_CHECKING_RECORDS),
  saveCheckingRecords: (records: CheckingRecord[]) => writeItem(KEYS.CHECKING_RECORDS, records),
  upsertCheckingRecord: (record: CheckingRecord): CheckingRecord => {
    const list = localStore.getCheckingRecords();
    const idx = list.findIndex((r) => r.checkingRecordId === record.checkingRecordId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.unshift(record);
    }
    localStore.saveCheckingRecords(list);
    return record;
  },

  getWorkflowEvents: (): WorkflowEvent[] =>
    readItem<WorkflowEvent[]>(KEYS.WORKFLOW_EVENTS, SEED_WORKFLOW_EVENTS),
  saveWorkflowEvents: (events: WorkflowEvent[]) => writeItem(KEYS.WORKFLOW_EVENTS, events),
  addWorkflowEvent: (event: WorkflowEvent): WorkflowEvent => {
    const list = localStore.getWorkflowEvents();
    list.unshift(event);
    localStore.saveWorkflowEvents(list.slice(0, 500));
    return event;
  },

  getSettings: (): SystemSettings => readItem<SystemSettings>(KEYS.SETTINGS, SEED_SETTINGS),
  saveSettings: (settings: SystemSettings) => writeItem(KEYS.SETTINGS, settings),

  getUsers: (): UserProfile[] => readItem<UserProfile[]>(KEYS.USERS, SEED_USERS),
  saveUsers: (users: UserProfile[]) => writeItem(KEYS.USERS, users),
  upsertUser: (user: UserProfile): UserProfile => {
    const list = localStore.getUsers();
    const idx = list.findIndex((u) => u.uid === user.uid || u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...user, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(user);
    }
    localStore.saveUsers(list);
    return user;
  },

  getReportJobs: (): ReportJob[] => readItem<ReportJob[]>(KEYS.REPORT_JOBS, []),
  saveReportJobs: (jobs: ReportJob[]) => writeItem(KEYS.REPORT_JOBS, jobs),
  upsertReportJob: (job: ReportJob): ReportJob => {
    const list = localStore.getReportJobs();
    const idx = list.findIndex((j) => j.jobId === job.jobId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...job, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(job);
    }
    localStore.saveReportJobs(list);
    return job;
  },

  getAuditLogs: (): AuditLog[] => readItem<AuditLog[]>(KEYS.AUDIT_LOGS, []),
  saveAuditLogs: (logs: AuditLog[]) => writeItem(KEYS.AUDIT_LOGS, logs),
  addAuditLog: (log: AuditLog): AuditLog => {
    const list = localStore.getAuditLogs();
    list.unshift(log);
    localStore.saveAuditLogs(list.slice(0, 200));
    return log;
  },
};
