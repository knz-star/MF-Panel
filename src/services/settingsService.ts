import { doc, getDoc, setDoc } from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';
import { SystemSettings } from '../types/workflow';
import { localStore } from './localStore';

export async function getSystemSettings(): Promise<SystemSettings> {
  const local = localStore.getSettings();

  try {
    const snap = await withTimeout(
      getDoc(doc(db, 'settings', 'global')),
      1500,
      null
    );
    if (snap && snap.exists()) {
      const merged = { ...local, ...snap.data() } as SystemSettings;
      localStore.saveSettings(merged);
      return merged;
    }
  } catch (err) {
    // Non-fatal
  }

  return local;
}

export async function updateSystemSettings(
  newSettings: Partial<SystemSettings>,
  adminUid: string
): Promise<SystemSettings> {
  const current = localStore.getSettings();
  const merged: SystemSettings = {
    ...current,
    ...newSettings,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid,
  };

  // 1. Instant local persistence
  localStore.saveSettings(merged);

  // 2. Async remote sync
  withTimeout(
    setDoc(doc(db, 'settings', 'global'), merged, { merge: true }),
    2000,
    undefined
  ).catch((err) => handleBackendError(err, OperationType.WRITE, 'settings/global'));

  return merged;
}
