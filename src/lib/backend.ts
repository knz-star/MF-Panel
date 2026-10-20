import { supabase, supabaseConfig as supabaseClientConfig } from './supabase';
import { db } from './supabaseDocumentStore';
import { auth } from './supabaseAuthCompat';
export { db, auth };
export const storage = { provider: 'supabase-storage' as const };
export const supabaseConfig = { projectId: supabaseClientConfig.projectRef, authDomain: new URL(supabaseClientConfig.url).host, storageBucket: 'mfp-assets', url: supabaseClientConfig.url };
export type ConnectionState = 'INITIALIZING' | 'CONNECTED' | 'OFFLINE' | 'ERROR';
export interface BackendConnectionStatus { state: ConnectionState; projectId: string; authDomain: string; errorMessage?: string; lastChecked: string }
export async function checkSupabaseConnection(): Promise<BackendConnectionStatus> {
  const base = { projectId: supabaseConfig.projectId, authDomain: supabaseConfig.authDomain, lastChecked: new Date().toISOString() };
  const { error } = await supabase.from('mfp_documents').select('id').limit(1);
  if (!error) return { ...base, state: 'CONNECTED' };
  const msg = error.message || 'Supabase connection failed';
  return { ...base, state: /network|fetch/i.test(msg) ? 'OFFLINE' : 'ERROR', errorMessage: msg };
}
export enum OperationType { CREATE='create', UPDATE='update', DELETE='delete', LIST='list', GET='get', WRITE='write' }
export interface BackendErrorInfo { code: string; message: string; operation: OperationType; path?: string }
export function handleBackendError(error: unknown, operation: OperationType, path?: string): BackendErrorInfo {
  const e = error as { code?: string; message?: string };
  const info = { code: e?.code || 'supabase/error', message: e?.message || String(error), operation, path };
  console.error('MF MPanel backend operation failed:', info); return info;
}
export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback?: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve, reject) => { timer = setTimeout(() => fallback !== undefined ? resolve(fallback as T) : reject(new Error(`Backend request timed out after ${ms}ms`)), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer!); }
}
