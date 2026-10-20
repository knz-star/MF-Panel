export type CheckingOutcome = 'VERIFIED' | 'FAILED_BLOCKED';

export interface CheckingRecord {
  checkingRecordId: string;
  profileId: string;
  outcome: CheckingOutcome;
  region?: string;
  associatedPostUrls?: string[];
  associatedPostIds?: string[];
  checkedBy: string;
  checkedByEmail?: string;
  checkedAt: string;
  notes?: string;
  isTestData?: boolean;
}

export interface CheckingQueueItem {
  profileId: string;
  srcReference: string;
  profileUrl: string;
  platform: string;
  queueAssignmentDate: string;
  assignedUser?: string;
  currentProcessingState: string;
}
