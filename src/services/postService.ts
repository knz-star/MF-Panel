import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  limit,
} from '../lib/supabaseDocumentStore';
import { db, withTimeout } from '../lib/backend';
import { PostRecord } from '../types/post';
import { normalizeUrl } from '../utils/urlNormalizer';
import { localStore } from './localStore';

const COLLECTION = 'posts';

export function generatePostId(): string {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PST-${dateStr}-${rand}`;
}

export async function createPost(data: {
  profileId: string;
  rawUrl: string;
  region?: string;
  createdBy: string;
  notes?: string;
  isTestData?: boolean;
}): Promise<PostRecord> {
  const norm = normalizeUrl(data.rawUrl);
  const postId = generatePostId();
  const nowIso = new Date().toISOString();

  const newPost: PostRecord = {
    postId,
    profileId: data.profileId.trim().toUpperCase(),
    canonicalUrl: norm.normalizedUrl,
    originalUrl: data.rawUrl,
    platform: norm.platform,
    region: data.region || '',
    notes: data.notes || '',
    createdBy: data.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
    isTestData: data.isTestData === true,
  };

  // Confirm cloud persistence before reporting the post as saved.
  await setDoc(doc(db, COLLECTION, postId), newPost);
  // The database trigger assigns the per-profile public MFP post number.
  const persisted = await getDoc(doc(db, COLLECTION, postId));
  const savedPost = persisted.exists() ? persisted.data() as PostRecord : newPost;
  localStore.upsertPost(savedPost);
  return savedPost;
}

export async function getPostsForProfile(profileId: string): Promise<PostRecord[]> {
  const cleanId = profileId.trim().toUpperCase();

  // Try Supabase database safely
  try {
    const q = query(
      collection(db, COLLECTION),
      where('profileId', '==', cleanId)
    );
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as PostRecord);
      for (const r of records) {
        localStore.upsertPost(r);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  const posts = localStore.getPosts().filter((p) => p.profileId === cleanId);
  return posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function listAllPosts(limitCount = 200): Promise<PostRecord[]> {
  try {
    const q = query(collection(db, COLLECTION), limit(limitCount));
    const snap = await withTimeout(getDocs(q), 1800, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as PostRecord);
      for (const r of records) {
        localStore.upsertPost(r);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  const posts = localStore.getPosts();
  return posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
