import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { checkSupabaseConnection, type BackendConnectionStatus } from '../../lib/backend';
import { type UserProfile, type ModuleKey, type TeamKey } from '../../types/user';
import { getUserProfile, createInitialUserProfile, ensureAdminProfile, hasAdminRecord, assignUserTeam } from '../../services/userService';

export interface AuthUser { uid: string; email: string | null; displayName: string | null; emailVerified?: boolean; gender?: 'male' | 'female' }
interface AuthContextType {
  currentUser: AuthUser | null; userProfile: UserProfile | null; isLoading: boolean; isAdmin: boolean; isTeamAdmin: boolean;
  connectionStatus: BackendConnectionStatus; profileLoadError: { code: string; message: string } | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (name: string, email: string, pass: string, gender: 'male' | 'female') => Promise<void>;
  assignTeam: (team: TeamKey) => Promise<void>; selectTeam: (team: TeamKey) => Promise<void>; loginWithGoogle: () => Promise<void>; logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; resendConfirmation: (email: string) => Promise<void>; hasModuleAccess: (module: ModuleKey) => boolean; refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const workspaceSelectionKey = (uid: string) => `mfp:workspace-selected:${uid}`;
const clearWorkspaceSelectionFlags = () => { try { for (let i = sessionStorage.length - 1; i >= 0; i--) { const key = sessionStorage.key(i); if (key?.startsWith('mfp:workspace-selected:')) sessionStorage.removeItem(key); } } catch {} };
const INITIAL_CONNECTION: BackendConnectionStatus = { state: 'INITIALIZING', projectId: 'nvzvyzgantmtwjfnrqdo', authDomain: 'nvzvyzgantmtwjfnrqdo.supabase.co', lastChecked: new Date().toISOString() };
function mapUser(user: any): AuthUser | null { return user ? { uid: user.id, email: user.email ?? null, displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null, emailVerified: !!user.email_confirmed_at, gender: user.user_metadata?.gender === 'male' || user.user_metadata?.gender === 'female' ? user.user_metadata.gender : undefined } : null; }

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>(INITIAL_CONNECTION);
  const [profileLoadError, setProfileLoadError] = useState<{ code: string; message: string } | null>(null);
  const hydrationPromises = useRef(new Map<string, Promise<void>>());
  const workspaceGateInitialized = useRef(false);

  const hydrateUserOnce = async (user: AuthUser): Promise<void> => {
    if (!workspaceGateInitialized.current) { try { sessionStorage.removeItem(workspaceSelectionKey(user.uid)); } catch {} workspaceGateInitialized.current = true; }
    setIsLoading(true); setProfileLoadError(null); setCurrentUser(user);
    try {
      const { error: ensureError } = await supabase.rpc('mfp_ensure_profile');
      if (ensureError) throw ensureError;
      let profile = await getUserProfile(user.uid);
      const adminAuthorized = await hasAdminRecord(user.uid);
      if (!profile) profile = await createInitialUserProfile(user.uid, user.email || '', user.displayName || user.email?.split('@')[0] || 'User', user.emailVerified, undefined, adminAuthorized, user.gender);
      else if (adminAuthorized && profile.role !== 'ADMIN' && profile.role !== 'TEAM_ADMIN') profile = await ensureAdminProfile(user.uid, user.email || profile.email, user.displayName || profile.displayName);
      setUserProfile(profile);
    } catch (error) {
      console.error('MF MPanel profile hydration failed:', error);
      const details = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
      setUserProfile(null); setProfileLoadError({ code: typeof details.code === 'string' ? details.code : 'profile/load-failed', message: typeof details.message === 'string' ? details.message : String(error) });
    } finally { setIsLoading(false); }
  };
  const hydrateUser = (user: AuthUser): Promise<void> => {
    const existing = hydrationPromises.current.get(user.uid); if (existing) return existing;
    const task = hydrateUserOnce(user).finally(() => hydrationPromises.current.delete(user.uid)); hydrationPromises.current.set(user.uid, task); return task;
  };
  useEffect(() => {
    void checkSupabaseConnection().then(setConnectionStatus);
    void supabase.auth.getSession().then(({ data }) => { const user = mapUser(data.session?.user); if (user) void hydrateUser(user); else setIsLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = mapUser(session?.user);
      if (!user) { hydrationPromises.current.clear(); setCurrentUser(null); setUserProfile(null); setProfileLoadError(null); setIsLoading(false); return; }
      void hydrateUser(user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => { if (!currentUser) return; setProfileLoadError(null); const profile = await getUserProfile(currentUser.uid); if (profile) setUserProfile(profile); };
  const loginWithEmail = async (email: string, pass: string) => { clearWorkspaceSelectionFlags(); setIsLoading(true); try { const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass }); if (error) throw error; const user = mapUser(data.user); if (user) { try { sessionStorage.removeItem(workspaceSelectionKey(user.uid)); } catch {} await hydrateUser(user); } } finally { setIsLoading(false); } };
  const signupWithEmail = async (name: string, email: string, pass: string, gender: 'male' | 'female') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: pass, options: { data: { full_name: name.trim(), gender }, emailRedirectTo: `${window.location.origin}/login` } });
      if (error) throw error;
      if (!data.session) throw new Error('Signup submitted. Please confirm your email from the inbox, then sign in.');
      const user = mapUser(data.user); if (user) await hydrateUser(user);
    } finally { setIsLoading(false); }
  };
  const assignTeam = async (team: TeamKey) => { if (!currentUser) throw new Error('Please sign in before selecting a team.'); if (await hasAdminRecord(currentUser.uid)) { await refreshProfile(); return; } const updated = await assignUserTeam(currentUser.uid, currentUser.email || '', currentUser.displayName || currentUser.email?.split('@')[0] || 'User', team); setUserProfile(updated); };
  const selectTeam = useCallback(async (team: TeamKey) => {
    if (!currentUser || !userProfile) throw new Error('Please sign in before switching teams.');
    if (userProfile.role === 'ADMIN') return;
    if (!(userProfile.allowedModules ?? []).includes(team)) throw new Error('This team is not assigned to your account.');
    const { data, error } = await supabase.rpc('mfp_select_team', { p_team: team });
    if (error) throw new Error(error.message || 'Could not switch team.');
    const row = (data && typeof data === 'object' ? data : {}) as Record<string, any>;
    setUserProfile(prev => prev ? { ...prev, team: row.team_key ?? team, teamConfirmed: true, allowedModules: Array.isArray(row.allowed_modules) ? row.allowed_modules : prev.allowedModules, accountStatus: row.account_status ?? prev.accountStatus } : prev);
    try { sessionStorage.setItem(workspaceSelectionKey(currentUser.uid), 'true'); } catch {}
  }, [currentUser, userProfile]);
  const loginWithGoogle = async () => { clearWorkspaceSelectionFlags(); const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); if (error) throw error; };
  const logout = async () => { if (currentUser?.uid) { try { sessionStorage.removeItem(workspaceSelectionKey(currentUser.uid)); } catch {} } const { error } = await supabase.auth.signOut(); if (error) throw error; setCurrentUser(null); setUserProfile(null); };
  const resetPassword = async (email: string) => { const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/login` }); if (error) throw error; };
  const resendConfirmation = async (email: string) => { const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/login` } }); if (error) throw error; };
  const isAdmin = !!currentUser && userProfile?.role === 'ADMIN' && userProfile.accountStatus === 'ACTIVE';
  const isTeamAdmin = !!currentUser && userProfile?.role === 'TEAM_ADMIN' && userProfile.accountStatus === 'ACTIVE';
  const hasModuleAccess = (module: ModuleKey): boolean => { if (!currentUser || !userProfile || userProfile.accountStatus !== 'ACTIVE') return false; if (isAdmin) return true; if (module === 'admin') return false; return userProfile.accountStatus === 'ACTIVE' && userProfile.allowedModules?.includes(module) === true; };
  return <AuthContext.Provider value={{ currentUser, userProfile, isLoading, isAdmin, isTeamAdmin, connectionStatus, profileLoadError, loginWithEmail, signupWithEmail, assignTeam, selectTeam, loginWithGoogle, logout, resetPassword, resendConfirmation, hasModuleAccess, refreshProfile }}>{children}</AuthContext.Provider>;
};
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
