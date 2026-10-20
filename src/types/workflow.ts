export interface WorkflowEvent {
  eventId: string;
  profileId: string;
  postId?: string;
  stage: 'SEARCHING' | 'CHECKING' | 'REPORTING' | 'ADMIN' | 'SYSTEM';
  action: string;
  previousStatus?: string;
  newStatus?: string;
  actorUid: string;
  actorEmail?: string;
  createdAt: string;
  metadata?: Record<string, any>;
  isTestData?: boolean;
}

export interface AuditLog {
  logId: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
  details?: Record<string, any>;
}

export interface SystemSettings {
  checkingQueueCapacity: number; // Default 500
  retentionHours: number; // Default 72
  maxZipSizeBytes: number; // Default 100MB
  maxLinksPerFolderLimit: number; // Default 500
  updatedAt?: string;
  updatedBy?: string;
}
