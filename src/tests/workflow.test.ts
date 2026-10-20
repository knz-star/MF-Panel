import { extractUrlsFromChatText } from '../utils/urlExtractor';
import { diagnoseError } from '../utils/errorDiagnostics';
import { normalizeUrl } from '../utils/urlNormalizer';
import { isUnsafePath } from '../utils/zipValidator';
import {
  buildDatabaseLookupMaps,
  matchUrlAgainstDatabase,
  matchScreenshotAgainstDatabase,
} from '../utils/matchingEngine';
import { ProfileRecord } from '../types/profile';
import { PostRecord } from '../types/post';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log('--- Running MF MPanel Workflow Tests ---');

  console.log('\nTest Suite 0: Error Source Diagnostics');
  assert(diagnoseError({ code: 'rpc/internal', message: 'Internal server error' }).source === 'BACKEND_DATABASE', 'Classified RPC internal errors as database backend failures');
  assert(diagnoseError({ code: 'permission-denied', message: 'Missing or insufficient permissions' }).source === 'BACKEND_DATABASE', 'Classified Supabase database permission errors as backend rules/service');
  assert(diagnoseError({ name: 'TypeError', message: 'Cannot read properties of undefined' }).source === 'FRONTEND', 'Classified JavaScript runtime errors as frontend');
  assert(diagnoseError({ code: 'invalid-api-key', message: 'invalid API key' }).source === 'SUPABASE_AUTH', 'Classified invalid Supabase keys as Authentication/configuration');

  // Test 1: URL extraction from unstructured WhatsApp chat
  console.log('\nTest Suite 1: WhatsApp / Telegram Text Extraction');
  const chatSample = `
[10/12/26, 09:15:00 AM] Alice: Look at https://instagram.com/target_brand/
[10/12/26, 09:16:30 AM] Bob: Here is a post: https://instagram.com/p/Cxyz123/?utm_medium=copy
Multiline message without timestamp:
Check out https://tiktok.com/@video_maker and https://youtube.com/@channel
`;
  const extracted = extractUrlsFromChatText(chatSample);
  assert(extracted.length >= 4, `Extracted 4 URLs from chat lines (got ${extracted.length})`);
  assert(extracted[0].normalized.platform === 'INSTAGRAM', 'Correctly classified Instagram');
  assert(extracted[0].normalized.urlType === 'PROFILE', 'Distinguished profile URL');
  assert(extracted[1].normalized.urlType === 'POST', 'Distinguished post URL');

  // Test 2: URL Normalization & Tracking parameter stripping
  console.log('\nTest Suite 2: Safe URL Normalization');
  const dirtyUrl = 'https://www.instagram.com/p/Cxyz123/?utm_source=ig_web&fbclid=123456';
  const normResult = normalizeUrl(dirtyUrl);
  assert(!normResult.normalizedUrl.includes('utm_source'), 'Stripped utm tracking parameters');
  assert(!normResult.normalizedUrl.includes('fbclid'), 'Stripped fbclid tracking parameters');
  assert(normResult.canonicalKey === 'ig_post_Cxyz123', 'Generated stable canonical key');

  // Test 3: Unsafe path & ZIP bomb defenses
  console.log('\nTest Suite 3: Archive Path Traversal & Security Bounds');
  assert(isUnsafePath('../evil.sh') === true, 'Caught directory traversal with ../');
  assert(isUnsafePath('/etc/passwd') === true, 'Caught absolute path traversal');
  assert(isUnsafePath('C:\\Windows\\system32\\evil.jpg') === true, 'Caught Windows absolute path traversal');
  assert(isUnsafePath('malware.exe') === true, 'Caught forbidden executable extension');
  assert(isUnsafePath('folder/screenshot.png') === false, 'Allowed valid screenshot path');

  // Test 4: Database Matching Priority Engine
  console.log('\nTest Suite 4: 5-Tier Database Matching Rules');
  const mockProfiles: ProfileRecord[] = [
    {
      profileId: 'PRF-20261013-0001',
      canonicalUrl: 'https://instagram.com/fashion_daily/',
      originalUrl: 'https://instagram.com/fashion_daily/',
      platform: 'INSTAGRAM',
      srcReferences: ['SRC-2026-9001'],
      currentWorkflowStatus: 'VERIFIED',
      postCount: 1,
      createdBy: 'USER_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockPosts: PostRecord[] = [
    {
      postId: 'PST-20261013-0001',
      profileId: 'PRF-20261013-0001',
      canonicalUrl: 'https://instagram.com/p/Cxyz123/',
      platform: 'INSTAGRAM',
      createdBy: 'USER_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const dbMaps = buildDatabaseLookupMaps(mockProfiles, mockPosts);

  // Exact post match
  const matchedPostUrl = matchUrlAgainstDatabase(
    { rawUrl: 'https://instagram.com/p/Cxyz123/', sourceFilename: 'links.txt', id: '1' },
    dbMaps
  );
  assert(matchedPostUrl.status === 'MATCHED', 'Matched post URL against database');
  assert(matchedPostUrl.matchedPostId === 'PST-20261013-0001', 'Bound to correct postId');
  assert(matchedPostUrl.matchedProfileId === 'PRF-20261013-0001', 'Preserved parent profileId');

  // Screenshot matching with exact PRF ID
  const shotPrf = matchScreenshotAgainstDatabase(
    { filename: 'PRF-20261013-0001-screen.png', path: 'shots/PRF-20261013-0001-screen.png', sizeBytes: 25000, id: 's1' },
    dbMaps
  );
  assert(shotPrf.status === 'MATCHED', 'Matched screenshot via exact Profile ID');
  assert(shotPrf.matchedProfileId === 'PRF-20261013-0001', 'Bound screenshot to PRF-20261013-0001');

  // Public MFP profile IDs and per-profile post IDs can repeat only where intended.
  const profileTwo: ProfileRecord = { ...mockProfiles[0], profileId: 'PRF-20261013-0002', mfpProfileId: 'MFP0000000000000002', canonicalUrl: 'https://instagram.com/second_profile/' };
  const profileOne = { ...mockProfiles[0], mfpProfileId: 'MFP0000000000000001' };
  const postOne: PostRecord = { ...mockPosts[0], mfpPostId: 'MFP1', mfpProfileId: 'MFP0000000000000001' };
  const postTwo: PostRecord = { ...mockPosts[0], postId: 'PST-20261013-0002', profileId: 'PRF-20261013-0002', mfpPostId: 'MFP1', mfpProfileId: 'MFP0000000000000002', canonicalUrl: 'https://instagram.com/p/secondPost/' };
  const publicMaps = buildDatabaseLookupMaps([profileOne, profileTwo], [postOne, postTwo]);
  const ambiguousMfpPost = matchScreenshotAgainstDatabase({ filename: 'MFP1.jpg', path: 'shots/MFP1.jpg', sizeBytes: 25000, id: 's-public-1' }, publicMaps);
  assert(ambiguousMfpPost.status === 'NEEDS_REVIEW', 'Repeated MFP1 labels across profiles are not auto-matched without parent profile ID');
  const parentQualifiedMfpPost = matchScreenshotAgainstDatabase({ filename: 'MFP1.jpg', path: 'shots/MFP0000000000000002/MFP1.jpg', sizeBytes: 25000, id: 's-public-2' }, publicMaps);
  assert(parentQualifiedMfpPost.status === 'MATCHED' && parentQualifiedMfpPost.matchedProfileId === 'PRF-20261013-0002', 'Parent profile MFP ID disambiguates a repeated MFP1 post label');
  const publicProfileShot = matchScreenshotAgainstDatabase({ filename: 'MFP0000000000000001.jpg', path: 'shots/MFP0000000000000001.jpg', sizeBytes: 25000, id: 's-public-3' }, publicMaps);
  assert(publicProfileShot.status === 'MATCHED' && publicProfileShot.matchedPublicProfileId === 'MFP0000000000000001', 'Matched screenshot using the permanent 16-digit MFP profile ID');

  // Screenshot without identity
  const shotRandom = matchScreenshotAgainstDatabase(
    { filename: 'random_picture_123.jpg', path: 'shots/random_picture_123.jpg', sizeBytes: 25000, id: 's2' },
    dbMaps
  );
  assert(shotRandom.status === 'UNMATCHED', 'Correctly classified screenshot without identity as UNMATCHED (no guessing)');

  // Test 5: Folder Partitioning Math
  console.log('\nTest Suite 5: Folder Target Configuration Math');
  const eligibleLinksCount = 450;
  const targetPerFolder = 100;
  const totalFolders = Math.ceil(eligibleLinksCount / targetPerFolder);
  assert(totalFolders === 5, 'Calculated exactly 5 folders for 450 links at 100/folder');

  console.log('\nAll MF MPanel automated tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
