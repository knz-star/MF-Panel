import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  limit,
} from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';
import { WorkflowEvent, AuditLog } from '../types/workflow';
import { localStore } from './localStore';

const COLLECTION_EVENTS = 'workflowEvents';
const COLLECTION_AUDIT = 'auditLogs';

export async function logWorkflowEvent(
  event: Omit<WorkflowEvent, 'eventId' | 'createdAt'>
): Promise<WorkflowEvent> {
  const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const fullEvent: WorkflowEvent = {
    ...event,
    eventId,
    createdAt: new Date().toISOString(),
  };

  // 1. Instant local persistence
  localStore.addWorkflowEvent(fullEvent);

  // 2. Safe async remote sync
  withTimeout(
    setDoc(doc(db, COLLECTION_EVENTS, eventId), fullEvent),
    2000,
    undefined
  ).catch((err) => handleBackendError(err, OperationType.WRITE, `${COLLECTION_EVENTS}/${eventId}`));

  return fullEvent;
}

export async function getWorkflowEventsForProfile(profileId: string): Promise<WorkflowEvent[]> {
  const cleanId = profileId.trim().toUpperCase();

  try {
    const q = query(
      collection(db, COLLECTION_EVENTS),
      where('profileId', '==', cleanId),
      limit(100)
    );
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as WorkflowEvent);
      for (const r of records) {
        localStore.addWorkflowEvent(r);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  const events = localStore.getWorkflowEvents().filter((e) => e.profileId === cleanId);
  return events.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function listRecentWorkflowActivity(limitCount = 50): Promise<WorkflowEvent[]> {
  try {
    const q = query(collection(db, COLLECTION_EVENTS), limit(limitCount));
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as WorkflowEvent);
      for (const r of records) {
        localStore.addWorkflowEvent(r);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  const events = localStore.getWorkflowEvents().slice(0, limitCount);
  return events.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function logAuditAction(log: Omit<AuditLog, 'logId' | 'createdAt'>): Promise<void> {
  const logId = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const fullLog: AuditLog = {
    ...log,
    logId,
    createdAt: new Date().toISOString(),
  };

  localStore.addAuditLog(fullLog);

  withTimeout(
    setDoc(doc(db, COLLECTION_AUDIT, logId), fullLog),
    2000,
    undefined
  ).catch((err) => console.warn('Could not log audit action to Supabase database:', err));
}

export async function listAuditLogs(limitCount = 100): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, COLLECTION_AUDIT), limit(limitCount));
    const snap = await withTimeout(getDocs(q), 1500, null);
    if (snap && !snap.empty) {
      const records = snap.docs.map((d) => d.data() as AuditLog);
      for (const r of records) {
        localStore.addAuditLog(r);
      }
    }
  } catch (err) {
    // Non-fatal
  }

  const logs = localStore.getAuditLogs().slice(0, limitCount);
  return logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
