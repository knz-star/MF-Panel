import { ProfileRecord } from '../types/profile';
import { PostRecord } from '../types/post';
import {
  ExtractedUrlItem,
  ExtractedScreenshotItem,
  MatchMethod,
  MatchStatus,
} from '../types/report';
import { normalizeUrl } from './urlNormalizer';

export interface DatabaseLookupMaps {
  profilesById: Map<string, ProfileRecord>;
  profilesByNormalizedUrl: Map<string, ProfileRecord>;
  profilesBySrcRef: Map<string, ProfileRecord>;
  postsById: Map<string, PostRecord>;
  postsByPublicId: Map<string, PostRecord[]>;
  postsByNormalizedUrl: Map<string, PostRecord>;
}

/**
 * Builds quick indexed lookup dictionaries from central records.
 */
export function buildDatabaseLookupMaps(
  profiles: ProfileRecord[],
  posts: PostRecord[]
): DatabaseLookupMaps {
  const profilesById = new Map<string, ProfileRecord>();
  const profilesByNormalizedUrl = new Map<string, ProfileRecord>();
  const profilesBySrcRef = new Map<string, ProfileRecord>();

  for (const p of profiles) {
    profilesById.set(p.profileId.trim().toUpperCase(), p);
    if (p.mfpProfileId) profilesById.set(p.mfpProfileId.trim().toUpperCase(), p);
    if (p.canonicalUrl) {
      const norm = normalizeUrl(p.canonicalUrl).normalizedUrl.toLowerCase();
      profilesByNormalizedUrl.set(norm, p);
    }
    if (p.srcReferences) {
      for (const src of p.srcReferences) {
        profilesBySrcRef.set(src.trim().toUpperCase(), p);
      }
    }
  }

  const postsById = new Map<string, PostRecord>();
  const postsByPublicId = new Map<string, PostRecord[]>();
  const postsByNormalizedUrl = new Map<string, PostRecord>();

  for (const post of posts) {
    postsById.set(post.postId.trim().toUpperCase(), post);
    if (post.mfpPostId) { const key = post.mfpPostId.trim().toUpperCase(); postsByPublicId.set(key, [...(postsByPublicId.get(key) ?? []), post]); }
    if (post.canonicalUrl) {
      const norm = normalizeUrl(post.canonicalUrl).normalizedUrl.toLowerCase();
      postsByNormalizedUrl.set(norm, post);
    }
  }

  return {
    profilesById,
    profilesByNormalizedUrl,
    profilesBySrcRef,
    postsById,
    postsByPublicId,
    postsByNormalizedUrl,
  };
}

/**
 * Matches an extracted URL against the central Supabase workflow database using priority rules.
 */
export function matchUrlAgainstDatabase(
  item: { rawUrl: string; sourceFilename: string; id: string },
  dbMaps: DatabaseLookupMaps
): ExtractedUrlItem {
  const norm = normalizeUrl(item.rawUrl);
  const targetUrl = norm.normalizedUrl.toLowerCase();

  let matchedProfileId: string | undefined;
  let matchedPostId: string | undefined;
  let matchedPublicProfileId: string | undefined;
  let matchedPublicPostId: string | undefined;
  let srcReference: string | undefined;
  let matchMethod: MatchMethod = 'UNMATCHED';
  let status: MatchStatus = 'UNMATCHED';
  let confidence = 0;
  let reviewNote: string | undefined;

  // 1. Direct post URL match
  if (dbMaps.postsByNormalizedUrl.has(targetUrl)) {
    const post = dbMaps.postsByNormalizedUrl.get(targetUrl)!;
    matchedPostId = post.postId;
    matchedPublicPostId = post.mfpPostId || post.postId;
    matchedProfileId = post.profileId;
    matchedPublicProfileId = post.mfpProfileId || dbMaps.profilesById.get(post.profileId.trim().toUpperCase())?.mfpProfileId || post.profileId;
    matchMethod = 'NORMALIZED_URL_MATCH';
    status = 'MATCHED';
    confidence = 1.0;
  }
  // 2. Direct profile URL match
  else if (dbMaps.profilesByNormalizedUrl.has(targetUrl)) {
    const profile = dbMaps.profilesByNormalizedUrl.get(targetUrl)!;
    matchedProfileId = profile.profileId;
    matchedPublicProfileId = profile.mfpProfileId || profile.profileId;
    srcReference = profile.srcReferences?.[0];
    matchMethod = 'NORMALIZED_URL_MATCH';
    status = 'MATCHED';
    confidence = 1.0;
  }
  // 3. Platform canonical key match if available
  else {
    // Check if URL syntax is valid
    if (norm.error) {
      status = 'INVALID';
      reviewNote = norm.error;
    } else {
      status = 'UNMATCHED';
      confidence = 0;
      reviewNote = 'URL not found in central database.';
    }
  }

  return {
    id: item.id,
    originalUrl: item.rawUrl,
    normalizedUrl: norm.normalizedUrl,
    sourceFilename: item.sourceFilename,
    platform: norm.platform,
    matchedProfileId,
    matchedPostId,
    matchedPublicProfileId,
    matchedPublicPostId,
    srcReference,
    matchMethod,
    status,
    confidence,
    reviewNote,
  };
}

/**
 * Matches a screenshot based on strict identity rules:
 * Priority 1: Exact permanent profileId (PRF-...) or postId (PST-...) in filename or folder
 * Priority 2: Exact supported SRC reference (SRC-...) in filename or folder
 * Priority 3: Ambiguous/Needs Review if multiple plausible IDs found
 * Priority 4: UNMATCHED if no stable identity present
 */
export function matchScreenshotAgainstDatabase(
  fileItem: { filename: string; path: string; sizeBytes: number; id: string },
  dbMaps: DatabaseLookupMaps
): ExtractedScreenshotItem {
  const fullPath = fileItem.path;
  const filename = fileItem.filename;

  let matchedProfileId: string | undefined;
  let matchedPostId: string | undefined;
  let matchedPublicProfileId: string | undefined;
  let matchedPublicPostId: string | undefined;
  let srcReference: string | undefined;
  let matchMethod: MatchMethod = 'UNMATCHED';
  let status: MatchStatus = 'UNMATCHED';
  let confidence = 0;

  // Look for PRF-... pattern (e.g. PRF-20261013-ABCD or PRF-123456)
  const prfMatches = fullPath.match(/PRF-[A-Za-z0-9]+(?:-[A-Za-z0-9]{2,8})?/gi) || [];
  const mfpProfileMatches = fullPath.match(/MFP\d{16}(?!\d)/gi) || [];
  // Look for PST-... pattern (e.g. PST-20261013-XYZ1)
  const pstMatches = fullPath.match(/PST-[A-Za-z0-9]+(?:-[A-Za-z0-9]{2,8})?/gi) || [];
  const mfpPostMatches = fullPath.match(/MFP\d{1,15}(?!\d)/gi) || [];
  const postMatches = [...pstMatches, ...mfpPostMatches];
  const profileMatches = [...prfMatches, ...mfpProfileMatches];
  // Look for SRC-... pattern (e.g. SRC-2026-9001)
  const srcMatches = fullPath.match(/SRC-[A-Za-z0-9]+(?:-[A-Za-z0-9]{2,8})?/gi) || [];

  // Internal PST IDs are globally unique. Public MFP post labels intentionally
  // repeat per profile, so they are only unambiguous when paired with a profile ID.
  if (postMatches.length === 1) {
    const candidatePostId = postMatches[0].toUpperCase();
    let candidates: PostRecord[] = [];
    if (candidatePostId.startsWith('PST-')) {
      const found = dbMaps.postsById.get(candidatePostId);
      if (found) candidates = [found];
    } else {
      candidates = [...(dbMaps.postsByPublicId.get(candidatePostId) ?? [])];
      const candidateProfiles = profileMatches.map((id) => dbMaps.profilesById.get(id.toUpperCase())).filter(Boolean) as ProfileRecord[];
      if (candidateProfiles.length > 0) {
        const profileIds = new Set(candidateProfiles.map((profile) => profile.profileId));
        candidates = candidates.filter((post) => profileIds.has(post.profileId));
      }
    }
    if (candidates.length === 1) {
      const post = candidates[0];
      matchedPostId = post.postId;
      matchedPublicPostId = post.mfpPostId || post.postId;
      matchedProfileId = post.profileId;
      matchedPublicProfileId = post.mfpProfileId || dbMaps.profilesById.get(post.profileId.trim().toUpperCase())?.mfpProfileId || post.profileId;
      matchMethod = 'EXACT_POST_ID';
      status = 'MATCHED';
      confidence = 1.0;
    } else {
      matchedPostId = candidatePostId;
      matchMethod = 'EXACT_POST_ID';
      status = 'NEEDS_REVIEW';
      confidence = candidates.length > 1 ? 0.3 : 0.6;
    }
  } else if (postMatches.length > 1) {
    status = 'NEEDS_REVIEW';
    confidence = 0.3;
  }

  // If not matched by post, check PRF matches
  if (status === 'UNMATCHED' && profileMatches.length === 1) {
    const candidateProfileId = profileMatches[0].toUpperCase();
    if (dbMaps.profilesById.has(candidateProfileId)) {
      const profile = dbMaps.profilesById.get(candidateProfileId)!;
      matchedProfileId = profile.profileId;
      matchedPublicProfileId = profile.mfpProfileId || profile.profileId;
      srcReference = profile.srcReferences?.[0];
      matchMethod = 'EXACT_PROFILE_ID';
      status = 'MATCHED';
      confidence = 1.0;
    } else {
      matchedProfileId = candidateProfileId;
      matchMethod = 'EXACT_PROFILE_ID';
      status = 'NEEDS_REVIEW';
      confidence = 0.6;
    }
  } else if (status === 'UNMATCHED' && profileMatches.length > 1) {
    status = 'NEEDS_REVIEW';
    confidence = 0.3;
  }

  // If not matched, check SRC matches
  if (status === 'UNMATCHED' && srcMatches.length === 1) {
    const candidateSrc = srcMatches[0].toUpperCase();
    if (dbMaps.profilesBySrcRef.has(candidateSrc)) {
      const profile = dbMaps.profilesBySrcRef.get(candidateSrc)!;
      matchedProfileId = profile.profileId;
      matchedPublicProfileId = profile.mfpProfileId || profile.profileId;
      srcReference = candidateSrc;
      matchMethod = 'EXACT_SRC_REF';
      status = 'MATCHED';
      confidence = 0.95;
    } else {
      srcReference = candidateSrc;
      matchMethod = 'EXACT_SRC_REF';
      status = 'NEEDS_REVIEW';
      confidence = 0.5;
    }
  }

  return {
    id: fileItem.id,
    filename,
    path: fileItem.path,
    sizeBytes: fileItem.sizeBytes,
    matchedProfileId,
    matchedPostId,
    matchedPublicProfileId,
    matchedPublicPostId,
    srcReference,
    matchMethod,
    status,
    confidence,
  };
}
