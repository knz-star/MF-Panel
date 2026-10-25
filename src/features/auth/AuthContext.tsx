import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { checkSupabaseConnection, type BackendConnectionStatus } from '../../lib/backend';
import { type UserProfile, type ModuleKey, type TeamKey } from '../../types/user';
import { getUserProfile, createInitialUserProfile, ensureAdminProfile, hasAdminRecord } from '../../services/userService';
import { localStore } from '../../services/localStore';

export interface AuthUser { uid: string; email: string | null; displayName: string | null; emailVerified?: boolean; gender?: 'male' | 'female' }
interface AuthContextType {
  currentUser: AuthUser | null; userProfile: UserProfile | null; isLoading: boolean; isAdmin: boolean; isTeamAdmin: boolean;
  connectionStatus: BackendConnectionStatus; profileLoadError: { code: string; message: string } | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (name: string, email: string, pass: string, gender: 'male' | 'female') => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; updatePassword: (password: string) => Promise<void>; hasModuleAccess: (module: ModuleKey) => boolean; refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const INITIAL_CONNECTION: BackendConnectionStatus = { state: 'INITIALIZING', projectId: 'nvzvyzgantmtwjfnrqdo', authDomain: 'nvzvyzgantmtwjfnrqdo.supabase.co', lastChecked: new Date().toISOString() };
function mapUser(user: any): AuthUser | null { return user ? { uid: user.id, email: user.email ?? null, displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null, emailVerified: !!user.email_confirmed_at, gender: user.user_metadata?.gender === 'male' || user.user_metadata?.gender === 'female' ? user.user_metadata.gender : undefined } : null; }

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>(INITIAL_CONNECTION);
  const [profileLoadError, setProfileLoadError] = useState<{ code: string; message: string } | null>(null);
  const hydrationPromises = useRef(new Map<string, Promise<void>>());
  // Native file pickers can suspend/resume the page and emit auth events. Keep a
  // successfully hydrated profile warm for 2 minutes to avoid a repeated RPC/read
  // waterfall; this is a UI hydration cooldown, not an authorization bypass.
  const profileHydratedAt = useRef(new Map<string, number>());
  const hydratedProfiles = useRef(new Map<string, UserProfile>());
  const readWarmProfile = (uid: string): { profile: UserProfile; hydratedAt: number } | null => {
    try {
      const raw = window.sessionStorage.getItem(`mfp-profile-hydration:${uid}`);
      if (!raw) return null;
      const value = JSON.parse(raw) as { profile?: UserProfile; hydratedAt?: number };
      if (value.profile?.uid !== uid || typeof value.hydratedAt !== 'number' || Date.now() - value.hydratedAt >= 120_000) { window.sessionStorage.removeItem(`mfp-profile-hydration:${uid}`); return null; }
      return { profile: value.profile, hydratedAt: value.hydratedAt };
    } catch { return null; }
  };

  const hydrateUserOnce = async (user: AuthUser): Promise<void> => {
    setIsLoading(true); setProfileLoadError(null); setCurrentUser(user);
    try {
      // Profile loading must not depend exclusively on the optional ensure RPC.
      // On a browser/file-picker resume, an RPC/network hiccup must not hide an
      // already-existing canonical profile and incorrectly block the workspace.
      const { error: ensureError } = await supabase.rpc('mfp_ensure_profile');
      if (ensureError) console.warn('mfp_ensure_profile was unavailable; checking the canonical profile directly.', ensureError);
      let profile = await getUserProfile(user.uid);
      const adminAuthorized = await hasAdminRecord(user.uid);
      if (!profile && !ensureError) {
        profile = await createInitialUserProfile(user.uid, user.email || '', user.displayName || user.email?.split('@')[0] || 'User', user.emailVerified, undefined, adminAuthorized, user.gender);
      }
      if (!profile) throw ensureError || new Error('Supabase Auth is signed in, but no readable mfp_user_profiles row exists for this account. Check profile RLS and mfp_ensure_profile migration.');
      if (adminAuthorized && profile.role !== 'ADMIN' && profile.role !== 'TEAM_ADMIN') profile = await ensureAdminProfile(user.uid, user.email || profile.email, user.displayName || profile.displayName);
      setUserProfile(profile);
      hydratedProfiles.current.set(user.uid, profile);
      profileHydratedAt.current.set(user.uid, Date.now());
      try { window.sessionStorage.setItem(`mfp-profile-hydration:${user.uid}`, JSON.stringify({ profile, hydratedAt: Date.now() })); } catch { /* Storage may be unavailable in private browsing; in-memory cooldown still works. */ }
    } catch (error) {
      console.error('MF MPanel profile hydration failed:', error);
      const details = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
      profileHydratedAt.current.delete(user.uid);
      hydratedProfiles.current.delete(user.uid);
      try { window.sessionStorage.removeItem(`mfp-profile-hydration:${user.uid}`); } catch { /* Ignore unavailable storage. */ }
      setUserProfile(null); setProfileLoadError({ code: typeof details.code === 'string' ? details.code : 'profile/load-failed', message: typeof details.message === 'string' ? details.message : String(error) });
    } finally { setIsLoading(false); }
  };
  const hydrateUser = (user: AuthUser): Promise<void> => {
    const existing = hydrationPromises.current.get(user.uid); if (existing) return existing;
    const cached = readWarmProfile(user.uid);
    const hydratedAt = profileHydratedAt.current.get(user.uid) ?? cached?.hydratedAt ?? 0;
    const warmProfile = hydratedProfiles.current.get(user.uid) ?? cached?.profile;
    if (warmProfile?.uid === user.uid && Date.now() - hydratedAt < 120_000) {
      setCurrentUser(user);
      setUserProfile(warmProfile);
      setProfileLoadError(null);
      setIsLoading(false);
      return Promise.resolve();
    }
    const task = hydrateUserOnce(user).finally(() => hydrationPromises.current.delete(user.uid)); hydrationPromises.current.set(user.uid, task); return task;
  };
  useEffect(() => {
    void checkSupabaseConnection().then(setConnectionStatus);
    void supabase.auth.getSession().then(({ data }) => { const user = mapUser(data.session?.user); if (user) void Promise.resolve().then(() => hydrateUser(user)); else setIsLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { try { window.sessionStorage.setItem('mfp-password-recovery-at', String(Date.now())); } catch { /* Recovery can continue without session storage if the URL still carries its token. */ } }
      const user = mapUser(session?.user);
      if (!user) { hydrationPromises.current.clear(); profileHydratedAt.current.clear(); hydratedProfiles.current.clear(); try { for (let i = window.sessionStorage.length - 1; i >= 0; i--) { const key = window.sessionStorage.key(i); if (key?.startsWith('mfp-profile-hydration:')) window.sessionStorage.removeItem(key); } } catch { /* Ignore unavailable storage. */ } setCurrentUser(null); setUserProfile(null); setProfileLoadError(null); setIsLoading(false); return; }
      void Promise.resolve().then(() => hydrateUser(user));
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => { if (!currentUser) return; setProfileLoadError(null); const profile = await getUserProfile(currentUser.uid); if (profile) { setUserProfile(profile); hydratedProfiles.current.set(currentUser.uid, profile); profileHydratedAt.current.set(currentUser.uid, Date.now()); try { window.sessionStorage.setItem(`mfp-profile-hydration:${currentUser.uid}`, JSON.stringify({ profile, hydratedAt: Date.now() })); } catch { /* Ignore unavailable storage. */ } } };
  const loginWithEmail = async (email: string, pass: string) => { setIsLoading(true); try { const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass }); if (error) throw error; const user = mapUser(data.user); if (user) await hydrateUser(user); } finally { setIsLoading(false); } };
  const signupWithEmail = async (name: string, email: string, pass: string, gender: 'male' | 'female') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { full_name: name.trim(), gender }, emailRedirectTo: `${window.location.origin}/login` } });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation must be disabled in Supabase Auth for immediate signup sessions.
        if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) { const existing = new Error('This email is already registered. Please sign in or use Forgot password.'); (existing as Error & { code?: string }).code = 'signup_existing_or_pending'; throw existing; }
        throw Object.assign(new Error('Supabase email confirmation is still enabled. Disable Confirm email in Supabase Dashboard → Authentication → Sign In / Providers → Email, then try again.'), { code: 'email_confirmation_enabled' });
      }
      const user = mapUser(data.user); if (user) await hydrateUser(user);
    } finally { setIsLoading(false); }
  };
  const logout = async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; localStore.clearAll(); setCurrentUser(null); setUserProfile(null); };
  const resetPassword = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: quota, error: quotaError } = await supabase.rpc('mfp_check_password_reset_quota', { p_email: normalizedEmail });
    if (quotaError) throw new Error('Password reset service is temporarily unavailable. Please try again later.');
    if (!quota?.allowed) {
      const limited = new Error(quota?.message || 'You can request password reset only twice in 7 days.') as Error & { code?: string; retryAt?: string };
      limited.code = 'password_reset_limit'; limited.retryAt = quota?.retryAt;
      throw limited;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw error;
  };
  const updatePassword = async (password: string) => { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; try { window.sessionStorage.removeItem('mfp-password-recovery-at'); } catch { /* Ignore unavailable session storage. */ } };
  const isAdmin = !!currentUser && userProfile?.role === 'ADMIN' && userProfile.accountStatus === 'ACTIVE';
  const isTeamAdmin = !!currentUser && userProfile?.role === 'TEAM_ADMIN' && userProfile.accountStatus === 'ACTIVE';
  const hasModuleAccess = (module: ModuleKey): boolean => { if (!currentUser || !userProfile || userProfile.accountStatus !== 'ACTIVE') return false; if (isAdmin) return true; if (module === 'admin') return false; const teamModules: TeamKey[] = ['searching','checking','reports','evidence']; if (teamModules.includes(module as TeamKey)) return userProfile.team === module && userProfile.allowedModules?.includes(module) === true; return userProfile.accountStatus === 'ACTIVE' && userProfile.allowedModules?.includes(module) === true; };
  return <AuthContext.Provider value={{ currentUser, userProfile, isLoading, isAdmin, isTeamAdmin, connectionStatus, profileLoadError, loginWithEmail, signupWithEmail, logout, resetPassword, updatePassword, hasModuleAccess, refreshProfile }}>{children}</AuthContext.Provider>;
};
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
