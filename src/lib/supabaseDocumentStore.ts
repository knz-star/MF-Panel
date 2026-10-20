import { supabase } from './supabase';

type Constraint = { kind: 'where'; field: string; op: string; value: unknown } | { kind: 'orderBy'; field: string; direction: 'asc'|'desc' } | { kind: 'limit'; count: number };
type CollectionRef = { __kind: 'collection'; name: string };
type DocumentRef = { __kind: 'document'; name: string; id: string };
type QueryRef = { __kind: 'query'; collection: CollectionRef; constraints: Constraint[] };
export type Unsubscribe = () => void;
export const db = { provider: 'supabase' as const };
export const collection = (_db: unknown, name: string): CollectionRef => ({ __kind: 'collection', name });
export const doc = (_db: unknown, name: string, id: string): DocumentRef => ({ __kind: 'document', name, id });
export const where = (field: string, op: string, value: unknown): Constraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, direction: 'asc'|'desc' = 'asc'): Constraint => ({ kind: 'orderBy', field, direction });
export const limit = (count: number): Constraint => ({ kind: 'limit', count });
export const query = (collectionRef: CollectionRef, ...constraints: Constraint[]): QueryRef => ({ __kind: 'query', collection: collectionRef, constraints });
export const serverTimestamp = (): string => new Date().toISOString();

async function authUid(): Promise<string | null> { const { data } = await supabase.auth.getUser(); return data.user?.id ?? null; }
async function currentTeam(): Promise<string | null> {
  const uid = await authUid(); if (!uid) return null;
  const { data } = await supabase.from('mfp_user_profiles').select('team_key').eq('user_id', uid).maybeSingle();
  return data?.team_key ?? null;
}
function jsonValue(row: any): any { return row?.data ?? {}; }
function makeDoc(row: any) { return { id: row.document_id, data: () => jsonValue(row), exists: () => !!row }; }
function makeQuerySnapshot(rows: any[]) { const docs = rows.map(makeDoc); return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: (d: any) => void) => docs.forEach(fn) }; }
async function selectRows(ref: CollectionRef, constraints: Constraint[] = []) {
  const allRows: any[] = [];
  const pageSize = 1000;
  const lim = constraints.find((c): c is Extract<Constraint,{kind:'limit'}> => c.kind === 'limit');
  const clientSort = constraints.some((c) => c.kind === 'orderBy');
  const fetchSize = lim && !clientSort ? Math.max(1, lim.count) : pageSize;
  for (let offset = 0; ; offset += fetchSize || pageSize) {
    let q = supabase.from('mfp_documents').select('id,collection_name,document_id,data,owner_uid,team_key,created_at,updated_at').eq('collection_name', ref.name);
    for (const c of constraints) if (c.kind === 'where') {
      const op = c.op === '==' ? 'eq' : c.op === '!=' ? 'neq' : c.op;
      const val = c.value as any;
      if (['eq','neq','gt','gte','lt','lte','like','ilike','is','in'].includes(op)) q = (q as any).filter(`data->>${c.field}`, op, String(val));
    }
    if (lim && !clientSort) q = (q as any).limit(lim.count);
    const { data, error } = await q.range(offset, offset + Math.max(0, fetchSize - 1));
    if (error) throw error;
    const rows = data ?? []; allRows.push(...rows);
    if ((lim && !clientSort) || rows.length < pageSize) break;
  }
  let rows = allRows;
  for (const c of constraints) if (c.kind === 'orderBy') rows = [...rows].sort((a: any,b: any) => {
    const av = a.data?.[c.field], bv = b.data?.[c.field];
    const cmp = av == null && bv == null ? 0 : av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
    return c.direction === 'desc' ? -cmp : cmp;
  });
  if (lim) rows = rows.slice(0, Math.max(0, lim.count));
  return rows;
}
export async function getDoc(ref: DocumentRef) {
  const { data, error } = await supabase.from('mfp_documents').select('*').eq('collection_name', ref.name).eq('document_id', ref.id).maybeSingle();
  if (error) throw error;
  return { id: ref.id, exists: () => !!data, data: () => data?.data ?? undefined };
}
export const getDocFromServer = getDoc;
export async function getDocs(ref: CollectionRef | QueryRef) {
  const qref = (ref as QueryRef).__kind === 'query' ? ref as QueryRef : { __kind: 'query' as const, collection: ref as CollectionRef, constraints: [] };
  return makeQuerySnapshot(await selectRows(qref.collection, qref.constraints));
}
function safeTeamFromData(data: any): string | null { return typeof data?.team === 'string' ? data.team : typeof data?.teamKey === 'string' ? data.teamKey : null; }
async function syncAuthProfile(collectionName: string, id: string, data: any) {
  if (collectionName !== 'users') return;
  const uid = await authUid(); if (!uid) return;
  let callerIsAdmin = false;
  const { data: caller } = await supabase.from('mfp_user_profiles').select('role,account_status').eq('user_id', uid).maybeSingle();
  callerIsAdmin = caller?.role === 'ADMIN' && caller?.account_status === 'ACTIVE';
  if (uid !== id && !callerIsAdmin) return;
  const payload = {
    user_id: id, email: data.email ?? null, display_name: data.displayName ?? data.display_name ?? 'User',
    role: data.role ?? 'USER', account_status: data.accountStatus ?? 'ACTIVE', team_key: safeTeamFromData(data),
    team_confirmed: data.teamConfirmed === true, allowed_modules: data.allowedModules ?? [], updated_at: new Date().toISOString(),
    ...(data.gender === 'male' || data.gender === 'female' ? { gender: data.gender, gender_group: data.gender } : {}),
  };
  const { error } = await supabase.from('mfp_user_profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}
export async function setDoc(ref: DocumentRef, value: Record<string, any>, options?: { merge?: boolean }) {
  const prior = options?.merge ? await getDoc(ref) : null;
  const data = options?.merge && prior?.exists() ? { ...(prior.data() ?? {}), ...value } : value;
  const uid = await authUid();
  const { data: existingRow } = await supabase.from('mfp_documents').select('owner_uid,team_key,created_at').eq('collection_name', ref.name).eq('document_id', ref.id).maybeSingle();
  const team = safeTeamFromData(data) ?? existingRow?.team_key ?? await currentTeam();
  const { error } = await supabase.from('mfp_documents').upsert({ collection_name: ref.name, document_id: ref.id, data, owner_uid: existingRow?.owner_uid ?? uid, team_key: team, created_at: existingRow?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'collection_name,document_id' });
  if (error) throw error;
  await syncAuthProfile(ref.name, ref.id, data);
}
export async function addDoc(ref: CollectionRef, value: Record<string, any>) {
  const id = crypto.randomUUID(); await setDoc({ __kind: 'document', name: ref.name, id }, value); return { id };
}
export async function updateDoc(ref: DocumentRef, patch: Record<string, any>) {
  const snap = await getDoc(ref); if (!snap.exists()) throw new Error(`Document not found: ${ref.name}/${ref.id}`);
  await setDoc(ref, { ...(snap.data() ?? {}), ...patch }, { merge: false });
}
export async function deleteDoc(ref: DocumentRef) {
  const { error } = await supabase.from('mfp_documents').delete().eq('collection_name', ref.name).eq('document_id', ref.id);
  if (error) throw error;
}
export function onSnapshot(ref: DocumentRef | CollectionRef | QueryRef, next: (snapshot: any) => void, error?: (error: Error) => void): Unsubscribe {
  let active = true;
  const refresh = async () => {
    try {
      if (!active) return;
      if ((ref as DocumentRef).__kind === 'document') next(await getDoc(ref as DocumentRef));
      else next(await getDocs(ref as CollectionRef | QueryRef));
    } catch (e) { if (active) error?.(e instanceof Error ? e : new Error(String(e))); }
  };
  void refresh();
  const channel = supabase.channel(`mfp-docs-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mfp_documents' }, () => { void refresh(); }).subscribe();
  return () => { active = false; void supabase.removeChannel(channel); };
}
export function writeBatch(_db: unknown) {
  const operations: Array<{ kind: 'set'|'update'|'delete'; ref: DocumentRef; data?: Record<string, any> }> = [];
  return {
    set: (r: DocumentRef, d: Record<string, any>) => { operations.push({ kind: 'set', ref: r, data: d }); },
    update: (r: DocumentRef, d: Record<string, any>) => { operations.push({ kind: 'update', ref: r, data: d }); },
    delete: (r: DocumentRef) => { operations.push({ kind: 'delete', ref: r }); },
    commit: async () => {
      if (operations.every((op) => op.kind === 'set')) {
        const uid = await authUid(); if (!uid) throw new Error('Authentication required to save workflow records.');
        const team = await currentTeam(); const now = new Date().toISOString();
        const rows = operations.map((op) => ({ collection_name: op.ref.name, document_id: op.ref.id, data: op.data ?? {}, owner_uid: uid, team_key: safeTeamFromData(op.data) ?? team, created_at: now, updated_at: now }));
        const { error } = await supabase.from('mfp_documents').upsert(rows, { onConflict: 'collection_name,document_id' });
        if (error) throw error;
        for (const op of operations) await syncAuthProfile(op.ref.name, op.ref.id, op.data ?? {});
        return;
      }
      for (const op of operations) {
        if (op.kind === 'set') await setDoc(op.ref, op.data ?? {});
        else if (op.kind === 'update') await updateDoc(op.ref, op.data ?? {});
        else await deleteDoc(op.ref);
      }
    },
  };
}
export async function runTransaction<T>(_db: unknown, callback: (tx: any) => Promise<T>): Promise<T> {
  const writes: Array<() => Promise<unknown>> = [];
  const tx = {
    get: (r: DocumentRef) => getDoc(r),
    set: (r: DocumentRef, d: Record<string, any>) => writes.push(() => setDoc(r, d)),
    update: (r: DocumentRef, d: Record<string, any>) => writes.push(() => updateDoc(r, d)),
    delete: (r: DocumentRef) => writes.push(() => deleteDoc(r)),
  };
  const result = await callback(tx);
  for (const write of writes) await write();
  return result;
}
