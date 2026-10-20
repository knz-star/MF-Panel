export type Platform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'X'
  | 'WEBSITE'
  | 'OTHER'
  | 'UNKNOWN';

export type WorkflowStatus =
  | 'SEARCHED'
  | 'QUEUED_CHECKING'
  | 'CHECKING'
  | 'VERIFIED'
  | 'FAILED_BLOCKED';

export interface ProfileRecord {
  profileId: string; // Internal stable record identifier (e.g. PRF-20261013-ABCD)
  mfpProfileId?: string; // Public permanent ID: MFP + 16 digits
  canonicalUrl: string; // Normalized URL
  originalUrl: string; // Raw input submitted
  platform: Platform;
  srcReferences: string[]; // E.g. ["SRC-2026-0012"]
  currentWorkflowStatus: WorkflowStatus;
  postCount: number;
  region?: string;
  notes?: string;
  queueAssignedAt?: string;
  assignedCheckerUid?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isTestData?: boolean;
}
