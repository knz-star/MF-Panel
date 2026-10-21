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
  // Canonical authorization source: Supabase profile row. The legacy document
  // mirror is merged only for non-security metadata such as pledge acceptance.
  const { data: canonical, error: canonicalError } = await withTimeout(
    Promise.resolve(supabase.from('mfp_user_profiles')
      .select('user_id,email,display_name,gender,gender_group,role,account_status,team_key,team_confirmed,allowed_modules,preferences,created_at,updated_at')
      .eq('user_id', uid).maybeSingle()),
    7000,
  );
  let canonicalRow: any = canonical;
  if (canonicalError) {
    // Authenticated self-profile RPC is a safe fallback when a transient Data API
    // SELECT/RLS issue occurs after a browser resumes from the native file picker.
    // The RPC derives auth.uid() server-side and returns only that account's profile.
    const { data: ensured, error: ensureError } = await supabase.rpc('mfp_ensure_profile');
    if (ensureError || !ensured || ensured.user_id !== uid) throw canonicalError;
    canonicalRow = {
      user_id: ensured.user_id, email: ensured.email, display_name: ensured.display_name,
      gender: ensured.gender, gender_group: ensured.gender_group, role: ensured.role,
      account_status: ensured.account_status, team_key: ensured.team_key,
      team_confirmed: ensured.team_confirmed, allowed_modules: ensured.allowed_modules,
      preferences: ensured.preferences ?? {}, created_at: ensured.created_at, updated_at: ensured.updated_at,
    };
  }
  let legacy: Record<string, any> = {};
  try {
    const { data } = await supabase.from('mfp_documents').select('data')
      .eq('collection_name', COLLECTION).eq('document_id', uid).maybeSingle();
    legacy = (data?.data && typeof data.data === 'object' ? data.data : {}) as Record<string, any>;
  } catch { /* Optional legacy mirror; canonical authorization remains authoritative. */ }
  if (canonicalRow) {
    const canonical = canonicalRow;
    const modules = Array.isArray(canonical.allowed_modules) ? canonical.allowed_modules : [];
    const profile: UserProfile = {
      ...legacy,
      uid: canonical.user_id,
      email: canonical.email ?? legacy.email ?? '',
      displayName: canonical.display_name ?? legacy.displayName ?? canonical.email?.split('@')[0] ?? 'User',
      gender: canonical.gender === 'male' || canonical.gender === 'female' ? canonical.gender : legacy.gender,
      genderGroup: canonical.gender_group ?? legacy.genderGroup,
      role: canonical.role,
      accountStatus: canonical.account_status,
      team: canonical.team_key ?? undefined,
      teamConfirmed: canonical.team_confirmed === true,
      allowedModules: modules,
      createdAt: canonical.created_at ?? legacy.createdAt,
      updatedAt: canonical.updated_at ?? legacy.updatedAt,
      pledgeAccepted: legacy.pledgeAccepted === true || (canonical.preferences && (canonical.preferences.pledgeAccepted === true || canonical.preferences.pledge_accepted === true)),
      pledgeSignature: canonical.preferences?.pledgeSignature ?? legacy.pledgeSignature,
      pledgeAcceptedAt: canonical.preferences?.pledgeAcceptedAt ?? legacy.pledgeAcceptedAt,
    } as UserProfile;
    localStore.upsertUser(profile);
    return profile;
  }
  // Backwards-compatible fallback only when a canonical row does not yet exist.
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
  const requestedTeam = params.allowedModules.find((module): module is TeamKey => teamModules.includes(module as TeamKey));
  const safeModules: ModuleKey[] = params.role === 'ADMIN' ? ['searching', 'checking', 'reports', 'evidence', 'admin'] : (requestedTeam ? [requestedTeam] : []);
  const singleTeam: TeamKey | undefined = params.role === 'ADMIN' ? undefined : requestedTeam;

  if (existing) {
    existing.role = params.role;
    existing.team = singleTeam;
    existing.allowedModules = safeModules;
    existing.accountStatus = params.accountStatus;
    existing.teamConfirmed = params.role === 'ADMIN' || (params.accountStatus === 'ACTIVE' && !!singleTeam);
    existing.updatedAt = new Date().toISOString();
    localStore.upsertUser(existing);
  }

  // A single privileged RPC updates canonical authorization and the compatibility
  // document mirror in one transaction. Never perform separate client writes here.
  const { data, error } = await supabase.rpc('mfp_admin_update_user_access', {
    p_target_uid: params.targetUid,
    p_role: params.role,
    p_account_status: params.accountStatus,
    p_team: singleTeam ?? null,
  });
  if (error) throw new Error(`Could not save user access: ${error.message}`);
  if (!data?.success) throw new Error('Could not confirm that user access was saved. Please refresh and retry.');
  const savedModules = Array.isArray(data.allowedModules) ? data.allowedModules as ModuleKey[] : safeModules;
  const savedTeam = (data.team ?? undefined) as TeamKey | undefined;
  const savedStatus = data.accountStatus as AccountStatus;
  const savedRole = data.role as UserRole;
  const savedConfirmed = data.teamConfirmed === true;
  const refreshed = localStore.getUsers().find((u) => u.uid === params.targetUid);
  if (refreshed) localStore.upsertUser({
    ...refreshed,
    role: savedRole,
    team: savedTeam,
    allowedModules: savedModules,
    accountStatus: savedStatus,
    teamConfirmed: savedConfirmed,
    updatedAt: new Date().toISOString(),
  });
}

export async function listAllUsers(limitCount = 100): Promise<UserProfile[]> {
  // Read the same canonical profile rows that authorize database operations, then merge
  // the optional legacy document fields (pledge metadata, display labels, etc.).
  try {
    const { data, error } = await supabase.rpc('mfp_admin_list_users', { p_limit: limitCount });
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
