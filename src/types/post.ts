import { Platform } from './profile';

export interface PostRecord {
  postId: string; // Internal stable record identifier (e.g. PST-20261013-XYZ1)
  mfpPostId?: string; // Public per-profile post label: MFP1, MFP2, ...
  mfpProfileId?: string; // Public ID of the parent profile
  profileId: string; // Parent profile
  canonicalUrl: string;
  originalUrl?: string;
  platform: Platform;
  region?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isTestData?: boolean;
}
