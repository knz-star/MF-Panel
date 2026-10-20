import { supabase } from './supabase';
export type User = { uid: string; email: string | null; displayName: string | null; emailVerified: boolean; getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }> };
function mapUser(user: any): User | null {
  if (!user) return null;
  return { uid: user.id, email: user.email ?? null, displayName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null, emailVerified: !!user.email_confirmed_at, getIdTokenResult: async () => ({ claims: {} }) };
}
export const auth = { get currentUser(): User | null { return cachedUser; } };
let cachedUser: User | null = null;
export function onAuthStateChanged(_auth: unknown, callback: (user: User | null) => void) {
  let alive = true;
  void supabase.auth.getSession().then(({ data }) => { if (alive) { cachedUser = mapUser(data.session?.user); callback(cachedUser); } });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { cachedUser = mapUser(session?.user); if (alive) callback(cachedUser); });
  return () => { alive = false; subscription.unsubscribe(); };
}
export async function signInWithEmailAndPassword(_auth: unknown, email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error;
  cachedUser = mapUser(data.user); return { user: cachedUser! };
}
export async function createUserWithEmailAndPassword(_auth: unknown, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password }); if (error) throw error;
  cachedUser = mapUser(data.user); if (!cachedUser) throw new Error('Signup submitted. Check your email to confirm the account before signing in.');
  return { user: cachedUser };
}
export async function signOut(_auth?: unknown) { const { error } = await supabase.auth.signOut(); if (error) throw error; cachedUser = null; }
export async function sendPasswordResetEmail(_auth: unknown, email: string) { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` }); if (error) throw error; }
export async function updateProfile(user: User, profile: { displayName?: string }) { const { error } = await supabase.auth.updateUser({ data: { full_name: profile.displayName } }); if (error) throw error; cachedUser = { ...user, displayName: profile.displayName ?? user.displayName }; }
export const GoogleAuthProvider = class GoogleAuthProvider {};
export async function signInWithPopup() { const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); if (error) throw error; return { user: cachedUser }; }

// Keep legacy-shaped currentUser consumers synchronized while the app migrates fully to Supabase Auth.
supabase.auth.onAuthStateChange((_event, session) => { cachedUser = mapUser(session?.user); });
