import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  limit,
} from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, ModuleKey, AccountStatus, TeamKey } from '../types/user';
import { localStore } from './localStore';

const COLLECTION = 'users';
/** Admin authority comes only from the protected Supabase profile row, never a client UID/email shortcut. */
export async function hasAdminRecord(uid: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('mfp_user_profiles').select('role,account_status').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    return data?.role === 'ADMIN' && data?.account_status === 'ACTIVE';
  } catch (error) {
    console.warn('Could not verify Supabase admin profile:', error);
    return false;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  // Authorization must never trust a localStorage profile. Read the persisted
  // Supabase record first; local cache is for non-sensitive lists only.

  // Fetch the persisted profile with a bounded wait.
  // Use the server so a cached/local profile cannot hide a deployed-rules error.
  // Permission-denied and network failures must reach the UI diagnostics instead
  // of being misreported as a brand-new user with no profile.
  const snap = await withTimeout(getDocFromServer(doc(db, COLLECTION, uid)), 7000);
  if (!snap.exists()) return null;
  const data = snap.data() as UserProfile;
  localStore.upsertUser(data);
  return data;
}

export async function createInitialUserProfile(
  uid: string,
  email: string,
  displayName: string,
  _emailVerified = false,
  _team?: TeamKey,
  adminAuthorized = false,
  gender?: 'male' | 'female',
): Promise<UserProfile> {
  const cleanEmail = email.toLowerCase().trim();
  const role: UserRole = adminAuthorized ? 'ADMIN' : 'USER';
  const now = new Date().toISOString();
  const userProfile: UserProfile = {
    uid,
    email: cleanEmail,
    displayName: displayName || cleanEmail.split('@')[0],
    gender,
    genderGroup: gender,
    role,
    allowedModules: adminAuthorized ? ['searching', 'checking', 'reports', 'evidence', 'admin'] as ModuleKey[] : [],
    teamConfirmed: adminAuthorized,
    accountStatus: adminAuthorized ? 'ACTIVE' : 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  // Persist every authenticated user's web profile immediately. Team access stays
  // empty until an administrator assigns one or more modules in User Management.
  // The own-document RLS policy allows this safe bootstrap without self-assignment.
  localStore.upsertUser(userProfile);
  await setDoc(doc(db, COLLECTION, uid), userProfile, { merge: true });
  return userProfile;
}

export async function assignUserTeam(uid: string, email: string, displayName: string, team: TeamKey): Promise<UserProfile> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user || authData.user.id !== uid) throw new Error('Authentication required for team selection.');
  const { data, error } = await supabase.rpc('mfp_assign_team', { p_team: team });
  if (error) throw error;
  const row = data as Record<string, any>;
  const updated: UserProfile = {
    uid, email: row.email ?? email.toLowerCase().trim(), displayName: row.displayName ?? displayName,
    role: row.role ?? 'USER', team: row.team ?? team, allowedModules: row.allowedModules ?? [team],
    teamConfirmed: row.teamConfirmed ?? true, accountStatus: row.accountStatus ?? 'ACTIVE',
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
  localStore.upsertUser(updated);
  return updated;
}

export async function ensureAdminProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid,
    email: email.toLowerCase().trim(),
    displayName: displayName || email.split('@')[0] || 'Administrator',
    role: 'ADMIN',
    allowedModules: ['searching', 'checking', 'reports', 'evidence', 'admin'],
    teamConfirmed: true,
    accountStatus: 'ACTIVE',
    updatedAt: now,
  };
  localStore.upsertUser(profile);
  await withTimeout(updateDoc(doc(db, COLLECTION, uid), {
    role: 'ADMIN',
    team: null,
    allowedModules: ['searching', 'checking', 'reports', 'evidence', 'admin'],
    teamConfirmed: true,
    accountStatus: 'ACTIVE',
    updatedAt: now,
  }), 3000, undefined);
  return profile;
}

export async function updateUserRoleAndModules(params: {
  targetUid: string;
  role: UserRole;
  allowedModules: ModuleKey[];
  accountStatus: AccountStatus;
  adminUid: string;
}): Promise<void> {
  const allUsers = localStore.getUsers();
  const existing = allUsers.find((u) => u.uid === params.targetUid);
  const teamModules: TeamKey[] = ['searching', 'checking', 'reports', 'evidence'];
  const safeModules: ModuleKey[] = params.role === 'ADMIN'
    ? ['searching', 'checking', 'reports', 'evidence', 'admin']
    : [...new Set(params.allowedModules.filter((module): module is TeamKey => teamModules.includes(module as TeamKey)))];
  const singleTeam: TeamKey | undefined = safeModules.find((module): module is TeamKey => teamModules.includes(module as TeamKey));

  if (existing) {
    existing.role = params.role;
    existing.team = singleTeam;
    existing.allowedModules = safeModules;
    existing.accountStatus = params.accountStatus;
    existing.teamConfirmed = params.accountStatus === 'ACTIVE' && safeModules.length > 0;
    existing.updatedAt = new Date().toISOString();
    localStore.upsertUser(existing);
  }

  // mfp_user_profiles is the canonical authorization source used by Edge Functions.
  // Update it first; otherwise the website can show a module grant that the backend rejects.
  const now = new Date().toISOString();
  const { error: canonicalError } = await supabase.from('mfp_user_profiles').update({
    role: params.role,
    account_status: params.accountStatus,
    team_key: singleTeam ?? null,
    team_confirmed: params.accountStatus === 'ACTIVE' && safeModules.some(m => teamModules.includes(m as TeamKey)),
    allowed_modules: safeModules,
    updated_at: now,
  }).eq('user_id', params.targetUid);
  if (canonicalError) throw new Error(`Could not update canonical team access: ${canonicalError.message}`);

  try {
    await withTimeout(updateDoc(doc(db, COLLECTION, params.targetUid), {
      role: params.role,
      team: singleTeam ?? null,
      allowedModules: safeModules,
      accountStatus: params.accountStatus,
      teamConfirmed: params.accountStatus === 'ACTIVE' && safeModules.length > 0,
      updatedAt: now,
    }), 5000, undefined);
  } catch (err) {
    // Canonical authorization is already updated; surface legacy mirror failure so it can be repaired.
    handleBackendError(err, OperationType.UPDATE, `${COLLECTION}/${params.targetUid}`);
  }
}

export async function listAllUsers(limitCount = 100): Promise<UserProfile[]> {
  // Read the same canonical profile rows that authorize Edge Functions, then merge
  // the optional legacy document fields (pledge metadata, display labels, etc.).
  try {
    const { data, error } = await supabase.from('mfp_user_profiles')
      .select('user_id,email,display_name,gender,gender_group,role,account_status,team_key,team_confirmed,allowed_modules,created_at,updated_at')
      .limit(limitCount);
    if (error) throw error;
    for (const row of data ?? []) {
      const current = localStore.getUsers().find(u => u.uid === row.user_id);
      const mapped: UserProfile = {
        ...(current ?? {} as UserProfile),
        uid: row.user_id,
        email: row.email ?? current?.email ?? '',
        displayName: row.display_name ?? current?.displayName ?? row.email?.split('@')[0] ?? 'User',
        gender: row.gender === 'male' || row.gender === 'female' ? row.gender : current?.gender,
        genderGroup: row.gender_group === 'male' || row.gender_group === 'female' ? row.gender_group : current?.genderGroup,
        role: row.role as UserRole,
        accountStatus: row.account_status as AccountStatus,
        team: (row.team_key ?? current?.team) as TeamKey | undefined,
        teamConfirmed: row.team_confirmed === true,
        allowedModules: Array.isArray(row.allowed_modules) ? row.allowed_modules as ModuleKey[] : current?.allowedModules ?? [],
        createdAt: row.created_at ?? current?.createdAt,
        updatedAt: row.updated_at ?? current?.updatedAt,
      };
      localStore.upsertUser(mapped);
    }
  } catch (err) {
    console.warn('Canonical user list unavailable; falling back to cached/legacy user records.', err);
  }
  try {
    const q = query(collection(db, COLLECTION), limit(limitCount));
    const snap = await withTimeout(getDocs(q), 5000, null);
    if (snap && !snap.empty) {
      for (const d of snap.docs) {
        const legacy = d.data() as UserProfile;
        const canonical = localStore.getUsers().find(u => u.uid === legacy.uid);
        localStore.upsertUser(canonical ? { ...legacy, ...canonical, pledgeAccepted: legacy.pledgeAccepted, pledgeSignature: legacy.pledgeSignature, pledgeAcceptedAt: legacy.pledgeAcceptedAt } : legacy);
      }
    }
  } catch (err) {
    console.warn('Legacy user metadata could not be refreshed.', err);
  }
  const users = localStore.getUsers();
  return users.sort((a, b) => {
    if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
    if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}
