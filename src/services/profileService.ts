import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  writeBatch,
} from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';
import { ProfileRecord, WorkflowStatus, Platform } from '../types/profile';
import { normalizeUrl } from '../utils/urlNormalizer';
import { localStore } from './localStore';

const COLLECTION = 'profiles';

export function generateProfileId(): string {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PRF-${dateStr}-${rand}`;
}

export function generateSrcReference(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SRC-${year}-${rand}`;
}

export async function getProfileById(profileId: string): Promise<ProfileRecord | null> {
  const cleanId = profileId.trim().toUpperCase();

  // Instant local check first
  const localList = localStore.getProfiles();
  const foundLocal = localList.find((p) => p.profileId === cleanId);

  // Parallel check Supabase database with fast timeout
  try {
    const snap = await withTimeout(
      getDoc(doc(db, COLLECTION, cleanId)),
      1500,
      null
    );
    if (snap && snap.exists()) {
      const remote = snap.data() as ProfileRecord;
      localStore.upsertProfile(remote);
      return remote;
    }
  } catch (err) {
    // Non-fatal, use local
  }

  return foundLocal || null;
}

export async function findProfileByCanonicalUrl(url: string): Promise<ProfileRecord | null> {
  const norm = normalizeUrl(url);

  // Fast check local storage
  const localList = localStore.getProfiles();
  const foundLocal = localList.find(
    (p) => p.canonicalUrl.toLowerCase() === norm.normalizedUrl.toLowerCase()
  );
  if (foundLocal) {
    return foundLocal;
  }

  // Try Supabase database with strict timeout
  try {
    const q = query(
      collection(db, COLLECTION),
      where('canonicalUrl', '==', norm.normalizedUrl),
      limit(1)
    );
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      const remote = snap.docs[0].data() as ProfileRecord;
      localStore.upsertProfile(remote);
      return remote;
    }
  } catch (err) {
    // Non-fatal
  }

  return null;
}

export async function createProfile(data: {
  rawUrl: string;
  createdBy: string;
  customSrc?: string;
  notes?: string;
}): Promise<{ profile: ProfileRecord; isExisting: boolean }> {
  const norm = normalizeUrl(data.rawUrl);
  const existing = await findProfileByCanonicalUrl(norm.normalizedUrl);

  const nowIso = new Date().toISOString();

  if (existing) {
    // Duplicate detected: Preserve existing canonical identity, append intake SRC if new
    const updatedSrcs = [...(existing.srcReferences || [])];
    const newSrc = data.customSrc || generateSrcReference();
    if (!updatedSrcs.includes(newSrc)) {
      updatedSrcs.push(newSrc);
      await updateDoc(doc(db, COLLECTION, existing.profileId), {
        srcReferences: updatedSrcs,
        updatedAt: nowIso,
      });
      existing.srcReferences = updatedSrcs;
      existing.updatedAt = nowIso;
      localStore.upsertProfile(existing);
    }
    return { profile: existing, isExisting: true };
  }

  // New canonical profile
  const profileId = generateProfileId();
  const srcRef = data.customSrc || generateSrcReference();

  const newProfile: ProfileRecord = {
    profileId,
    canonicalUrl: norm.normalizedUrl,
    originalUrl: data.rawUrl,
    platform: norm.platform,
    srcReferences: [srcRef],
    currentWorkflowStatus: 'SEARCHED',
    postCount: 0,
    notes: data.notes || '',
    createdBy: data.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Await the cloud write before reporting success; never silently count local-only data as saved.
  await setDoc(doc(db, COLLECTION, profileId), newProfile);
  // The database trigger assigns the public MFP ID; re-read the persisted row so
  // the UI/local cache immediately reflects the canonical value.
  const persisted = await getDoc(doc(db, COLLECTION, profileId));
  const savedProfile = persisted.exists() ? persisted.data() as ProfileRecord : newProfile;
  localStore.upsertProfile(savedProfile);
  return { profile: savedProfile, isExisting: false };
}

/**
 * Imports a large set in Supabase database batches. Cloud writes are awaited; a permission
 * error is returned to the UI instead of claiming that local-only records were saved.
 */
export async function createProfilesBulk(items: Array<{ rawUrl: string; createdBy: string; notes?: string }>): Promise<{ created: ProfileRecord[]; skippedDuplicates: number }> {
  if (!items.length) return { created: [], skippedDuplicates: 0 };
  // One canonical lookup for the batch rather than one query per URL.
  const existingSnapshot = await getDocs(collection(db, COLLECTION));
  const known = new Set<string>();
  for (const snap of existingSnapshot.docs) {
    const data = snap.data() as ProfileRecord;
    if (data.canonicalUrl) known.add(normalizeUrl(data.canonicalUrl).normalizedUrl.toLowerCase());
  }
  const created: ProfileRecord[] = [];
  let skippedDuplicates = 0;
  const now = new Date().toISOString();
  for (const item of items) {
    const norm = normalizeUrl(item.rawUrl);
    const canonical = norm.normalizedUrl.toLowerCase();
    if (!canonical || norm.error || known.has(canonical)) { skippedDuplicates++; continue; }
    known.add(canonical);
    const profileId = generateProfileId();
    const srcRef = generateSrcReference();
    created.push({ profileId, canonicalUrl: norm.normalizedUrl, originalUrl: item.rawUrl, platform: norm.platform, srcReferences: [srcRef], currentWorkflowStatus: 'SEARCHED', postCount: 0, notes: item.notes || '', createdBy: item.createdBy, createdAt: now, updatedAt: now });
  }
  // At most 200 profiles per commit so profiles and immutable workflow events fit under 500 writes.
  for (let start = 0; start < created.length; start += 200) {
    const batch = writeBatch(db);
    const chunk = created.slice(start, start + 200);
    for (const profile of chunk) {
      batch.set(doc(db, COLLECTION, profile.profileId), profile);
      const eventId = `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      batch.set(doc(db, 'workflowEvents', eventId), {
        eventId, profileId: profile.profileId, stage: 'SEARCHING', action: 'INTAKE_PROFILE_REGISTERED',
        previousStatus: null, newStatus: profile.currentWorkflowStatus, actorUid: profile.createdBy,
        actorEmail: '', metadata: { sourceRawUrl: profile.originalUrl, canonicalUrl: profile.canonicalUrl, src: profile.srcReferences[0] }, createdAt: now,
      });
    }
    await batch.commit();
  }
  for (const profile of created) localStore.upsertProfile(profile);
  return { created, skippedDuplicates };
}

export async function listProfiles(options?: {
  status?: WorkflowStatus;
  platform?: Platform;
  limitCount?: number;
}): Promise<ProfileRecord[]> {
  // Try remote Supabase database with fast timeout
  try {
    let q = query(collection(db, COLLECTION), limit(options?.limitCount || 200));
    if (options?.status) {
      q = query(
        collection(db, COLLECTION),
        where('currentWorkflowStatus', '==', options.status),
        limit(options?.limitCount || 200)
      );
    }
    const snap = await withTimeout(getDocs(q), 1800, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as ProfileRecord);
      for (const r of records) {
        localStore.upsertProfile(r);
      }
    }
  } catch (err) {
    // Non-fatal, localStore holds pristine records
  }

  // Retrieve and filter from localStore
  let records = localStore.getProfiles();
  if (options?.status) {
    records = records.filter((p) => p.currentWorkflowStatus === options.status);
  }
  if (options?.platform) {
    records = records.filter((p) => p.platform === options.platform);
  }

  return records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function updateProfileWorkflowStatus(
  profileId: string,
  newStatus: WorkflowStatus,
  extra?: Partial<ProfileRecord>
): Promise<void> {
  const cleanId = profileId.trim().toUpperCase();
  const nowIso = new Date().toISOString();

  await updateDoc(doc(db, COLLECTION, cleanId), {
    currentWorkflowStatus: newStatus,
    updatedAt: nowIso,
    ...extra,
  });
  const localProfiles = localStore.getProfiles();
  const existing = localProfiles.find((p) => p.profileId === cleanId);
  if (existing) {
    Object.assign(existing, { currentWorkflowStatus: newStatus, updatedAt: nowIso, ...extra });
    localStore.upsertProfile(existing);
  }
}

/** Permanently remove a profile from Supabase database and this browser's local cache. Call only from an admin-only UI. */
export async function deleteProfile(profileId: string): Promise<void> {
  const cleanId = profileId.trim().toUpperCase();
  await deleteDoc(doc(db, COLLECTION, cleanId));
  localStore.saveProfiles(localStore.getProfiles().filter((profile) => profile.profileId !== cleanId));
}
