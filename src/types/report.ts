export type ReportProcessingStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'ANALYZING'
  | 'NEEDS_REVIEW'
  | 'READY_TO_PACKAGE'
  | 'PACKAGING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type MatchMethod =
  | 'EXACT_PROFILE_ID'
  | 'EXACT_POST_ID'
  | 'EXACT_SRC_REF'
  | 'NORMALIZED_URL_MATCH'
  | 'CANONICAL_URL_MATCH'
  | 'USER_CONFIRMED'
  | 'UNMATCHED';

export type MatchStatus = 'MATCHED' | 'NEEDS_REVIEW' | 'UNMATCHED' | 'INVALID';

export interface ExtractedUrlItem {
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  sourceFilename: string;
  platform: string;
  matchedProfileId?: string;
  matchedPostId?: string;
  matchedPublicProfileId?: string;
  matchedPublicPostId?: string;
  srcReference?: string;
  batchLinkId?: string;
  matchMethod: MatchMethod;
  status: MatchStatus;
  confidence: number; // 0 to 1
  reviewNote?: string;
}

export interface ExtractedScreenshotItem {
  id: string;
  filename: string;
  path: string;
  sizeBytes: number;
  matchedProfileId?: string;
  matchedPostId?: string;
  matchedPublicProfileId?: string;
  matchedPublicPostId?: string;
  srcReference?: string;
  batchLinkId?: string;
  sha256Checksum?: string;
  capturedAt?: number;
  duplicateChecksum?: boolean;
  matchMethod: MatchMethod;
  status: MatchStatus;
  confidence: number;
  reviewNote?: string;
  dataUrl?: string; // Preview thumbnail if available
  blob?: Blob;
}

export interface ReportJob {
  jobId: string;
  createdBy: string;
  creatorEmail?: string;
  sourceArchiveName: string;
  archiveSizeBytes: number;
  processingStatus: ReportProcessingStatus;
  requestedLinksPerFolder: number; // e.g. 100
  inputLinkCount: number;
  uniqueLinkCount: number;
  matchedScreenshotCount: number;
  unmatchedScreenshotCount: number;
  reviewRequiredCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  errorMessage?: string;
}

export interface ReportPackageManifest {
  jobId: string;
  batchId?: string;
  batchName?: string;
  exportId?: string;
  creationTimestamp: string;
  sourceArchiveName: string;
  inputLinkCount: number;
  uniqueEligibleLinks: number;
  matchedScreenshotCount: number;
  unmatchedScreenshotCount: number;
  needsReviewScreenshotCount?: number;
  unresolvedItemsCount: number;
  folderConfiguration: {
    linksPerFolder: number;
    totalFolders: number;
  };
  folders: {
    folderName: string;
    linksCount: number;
    screenshotsCount: number;
  }[];
  links?: Array<{ linkId: string; url: string; profileId?: string; sourceProfileId?: string; mfpProfileId?: string; postIds: string[]; postLinks: Array<{ postId: string; url: string }>; screenshotIds: string[]; verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'MISMATCH' }>; 
  screenshotsPdfParts?: Array<{ fileName: string; pageCount: number }>;
  processingOutcome: string;
}


export interface EvidenceBatchManifest {
  manifestVersion?: string;
  batchId?: string;
  batchName?: string;
  exportId?: string;
  exportingUserUid?: string;
  exportTimestamp?: number;
  totalLinks?: number;
  totalScreenshots?: number;
  encryptionAlgorithm?: string;
  links: Array<{
    linkId: string; url: string; platform?: string; profileId?: string; sourceProfileId?: string; mfpProfileId?: string; requiredCount?: number; requiredScreenshots?: number; actualCount?: number; status?: string; notes?: string;
    postIds?: string[];
    postLinks?: Array<{ postId?: string; internalPostId?: string; url: string; platform?: string }>;
    screenshotIds?: string[];
    screenshots?: Array<{ screenshotId?: string; screenshot_id?: string; id?: string; fileName: string; capturedAt?: number; fileSizeBytes?: number; sha256Checksum?: string; mimeType?: string }>;
  }>;
}
