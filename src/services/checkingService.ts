import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
} from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';
import { CheckingRecord, CheckingOutcome, CheckingQueueItem } from '../types/checking';
import { ProfileRecord } from '../types/profile';
import { getSystemSettings } from './settingsService';
import { createPost } from './postService';
import { logWorkflowEvent } from './workflowService';
import { localStore } from './localStore';
import { getProfileById, updateProfileWorkflowStatus } from './profileService';
import { createCheckingHandoff } from './workflowAutomationService';

const PROFILES_COLLECTION = 'profiles';
const CHECKING_RECORDS_COLLECTION = 'checkingRecords';

export async function getCheckingQueueStats(): Promise<{
  activeQueueCount: number;
  capacityLimit: number;
  remainingCapacity: number;
}> {
  const settings = await getSystemSettings();
  const capacityLimit = settings.checkingQueueCapacity || 500;

  // Count from local store instantly
  const localQueued = localStore
    .getProfiles()
    .filter((p) => p.currentWorkflowStatus === 'QUEUED_CHECKING');
  let activeQueueCount = localQueued.length;

  try {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('currentWorkflowStatus', '==', 'QUEUED_CHECKING')
    );
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap) {
      activeQueueCount = Math.max(activeQueueCount, snap.size);
    }
  } catch (err) {
    // Non-fatal
  }

  const remainingCapacity = Math.max(0, capacityLimit - activeQueueCount);
  return {
    activeQueueCount,
    capacityLimit,
    remainingCapacity,
  };
}

export async function getCheckingQueue(limitCount = 100): Promise<CheckingQueueItem[]> {
  try {
    const q = query(
      collection(db, PROFILES_COLLECTION),
      where('currentWorkflowStatus', '==', 'QUEUED_CHECKING'),
      limit(limitCount)
    );
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      for (const d of snap.docs) {
        localStore.upsertProfile(d.data() as ProfileRecord);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  const items = localStore
    .getProfiles()
    .filter((p) => p.currentWorkflowStatus === 'QUEUED_CHECKING')
    .slice(0, limitCount)
    .map((data) => ({
      profileId: data.profileId,
      srcReference: data.srcReferences?.[0] || 'N/A',
      profileUrl: data.canonicalUrl,
      platform: data.platform,
      queueAssignmentDate: data.queueAssignedAt || data.updatedAt || data.createdAt,
      assignedUser: data.assignedCheckerUid,
      currentProcessingState: data.currentWorkflowStatus,
    }));

  return items.sort((a, b) =>
    (b.queueAssignmentDate || '').localeCompare(a.queueAssignmentDate || '')
  );
}

export async function enqueueProfileForChecking(
  profileId: string,
  actorUid: string,
  actorEmail?: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = profileId.trim().toUpperCase();

  // Check capacity
  const stats = await getCheckingQueueStats();
  if (stats.remainingCapacity <= 0) {
    throw new Error(
      `Checking queue capacity limit reached (${stats.capacityLimit}). Cannot enqueue more profiles until existing queue records are checked.`
    );
  }

  const existingProfile = await getProfileById(cleanId);
  if (!existingProfile) {
    throw new Error(`Profile ${cleanId} not found.`);
  }

  if (existingProfile.currentWorkflowStatus === 'QUEUED_CHECKING') {
    return { success: false, message: 'Profile is already in Checking queue.' };
  }

  const nowIso = new Date().toISOString();
  await updateProfileWorkflowStatus(cleanId, 'QUEUED_CHECKING', {
    queueAssignedAt: nowIso,
  });

  await logWorkflowEvent({
    profileId: cleanId,
    stage: 'SEARCHING',
    action: 'HANDOFF_TO_CHECKING_QUEUE',
    previousStatus: existingProfile.currentWorkflowStatus,
    newStatus: 'QUEUED_CHECKING',
    actorUid,
    actorEmail,
    metadata: { assignedQueueCapacity: stats.capacityLimit },
  });

  return { success: true, message: `Profile ${cleanId} successfully enqueued for Checking.` };
}

export async function submitCheckingDecision(params: {
  profileId: string;
  outcome: CheckingOutcome;
  region?: string;
  postUrls?: string[];
  notes?: string;
  checkerUid: string;
  checkerEmail?: string;
}): Promise<CheckingRecord> {
  const cleanProfileId = params.profileId.trim().toUpperCase();
  const profileData = await getProfileById(cleanProfileId);
  if (!profileData) {
    throw new Error(`Profile ${cleanProfileId} not found.`);
  }

  const nowIso = new Date().toISOString();
  const recordId = `CHK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const createdPostIds: string[] = [];
  const associatedPostUrls: string[] = [];

  // If VERIFIED, create up to 3 posts
  if (params.outcome === 'VERIFIED' && params.postUrls && params.postUrls.length > 0) {
    const urlsToCreate = params.postUrls.filter((u) => u && u.trim().length > 0).slice(0, 3);
    for (const rawUrl of urlsToCreate) {
      const createdPost = await createPost({
        profileId: cleanProfileId,
        rawUrl: rawUrl.trim(),
        region: params.region,
        createdBy: params.checkerUid,
        notes: params.notes,
        isTestData: profileData.isTestData === true,
      });
      createdPostIds.push(createdPost.postId);
      associatedPostUrls.push(createdPost.canonicalUrl);
    }
  }

  const checkingRecord: CheckingRecord = {
    checkingRecordId: recordId,
    profileId: cleanProfileId,
    outcome: params.outcome,
    region: params.region || '',
    associatedPostUrls,
    associatedPostIds: createdPostIds,
    checkedBy: params.checkerUid,
    checkedByEmail: params.checkerEmail || '',
    checkedAt: nowIso,
    notes: params.notes || '',
    isTestData: profileData.isTestData === true,
  };

  // Await cloud persistence so permission failures are shown to the checker.
  await setDoc(doc(db, CHECKING_RECORDS_COLLECTION, recordId), checkingRecord);
  localStore.upsertCheckingRecord(checkingRecord);

  // Update profile status & postCount
  const newWorkflowStatus = params.outcome === 'VERIFIED' ? 'VERIFIED' : 'FAILED_BLOCKED';
  const newPostCount = (profileData.postCount || 0) + createdPostIds.length;

  await updateProfileWorkflowStatus(cleanProfileId, newWorkflowStatus, {
    region: params.region || profileData.region || '',
    postCount: newPostCount,
    notes: params.notes || profileData.notes || '',
  });

  // Use the authenticated server-side function for downstream writes so team RLS does not block or spoof the handoff.
  await createCheckingHandoff(cleanProfileId, params.outcome, recordId, params.notes || '');

  // Log workflow transition
  await logWorkflowEvent({
    profileId: cleanProfileId,
    stage: 'CHECKING',
    action: `CHECKING_${params.outcome}`,
    previousStatus: profileData.currentWorkflowStatus,
    newStatus: newWorkflowStatus,
    actorUid: params.checkerUid,
    actorEmail: params.checkerEmail,
    metadata: {
      outcome: params.outcome,
      region: params.region,
      createdPostCount: createdPostIds.length,
      postIds: createdPostIds,
    },
    isTestData: profileData.isTestData === true,
  });

  return checkingRecord;
}

export async function listCheckingRecords(
  outcome?: CheckingOutcome,
  limitCount = 100
): Promise<CheckingRecord[]> {
  try {
    let q = query(collection(db, CHECKING_RECORDS_COLLECTION), limit(limitCount));
    if (outcome) {
      q = query(
        collection(db, CHECKING_RECORDS_COLLECTION),
        where('outcome', '==', outcome),
        limit(limitCount)
      );
    }
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as CheckingRecord);
      for (const r of records) {
        localStore.upsertCheckingRecord(r);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  let list = localStore.getCheckingRecords();
  if (outcome) {
    list = list.filter((r) => r.outcome === outcome);
  }

  return list.sort((a, b) => (b.checkedAt || '').localeCompare(a.checkedAt || ''));
}
