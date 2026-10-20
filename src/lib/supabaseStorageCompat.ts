import { supabase } from './supabase';
export const storage = { provider: 'supabase-storage' as const };
export function ref(_storage: unknown, path: string) { return { path }; }
export async function uploadBytes(objectRef: { path: string }, file: File, options?: { contentType?: string; customMetadata?: Record<string,string> }) {
  const { data, error } = await supabase.storage.from('mfp-assets').upload(objectRef.path, file, { contentType: options?.contentType ?? file.type, upsert: true, cacheControl: '3600' });
  if (error) throw error; return { path: data.path, fullPath: data.path };
}
export async function getDownloadURL(objectRef: { path: string }) { return supabase.storage.from('mfp-assets').getPublicUrl(objectRef.path).data.publicUrl; }
export async function deleteObject(objectRef: { path: string }) { const { error } = await supabase.storage.from('mfp-assets').remove([objectRef.path]); if (error) throw error; }
