import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Archive, Camera, RefreshCw, Smartphone, Settings2, Workflow, Save, ShieldAlert } from 'lucide-react';
import { invokeWebsiteApi } from '../../services/webApiClient';
import { supabase } from '../../lib/supabase';

type Row = Record<string, unknown>;
type Tab = 'workItems' | 'activity' | 'connections' | 'registrations' | 'settings';
const tabs: { id: Tab; label: string; icon: React.ComponentType<{className?: string}>; table?: string }[] = [
  { id: 'workItems', label: 'Evidence work items', icon: Archive, table: 'mfp_evidence_work_items' },
  { id: 'activity', label: 'Activity events', icon: Camera, table: 'mfp_evidence_activity_events' },
  { id: 'connections', label: 'Connection events', icon: Workflow, table: 'mfp_evidence_connection_events' },
  { id: 'registrations', label: 'Device registrations', icon: Smartphone, table: 'mfp_evidence_app_registrations' },
  { id: 'settings', label: 'Export settings', icon: Settings2 },
];
const pretty = (v: unknown) => v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const first = (row: Row, keys: string[]) => { for (const key of keys) if (row[key] != null && row[key] !== '') return row[key]; return null; };

export const AdminEvidenceOperationsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('workItems');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zipPassword, setZipPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      if (tab === 'settings') {
        const data = await invokeWebsiteApi<any>('mfp-admin-export-settings', { action: 'read' });
        if (data?.error) throw new Error(String(data.error));
        setZipPassword(String(data?.zip_password ?? data?.settings?.zip_password ?? ''));
        setRows(data ? [{ key: 'export_settings', value: { configured: Boolean(data?.zip_password) } }] : []);
      } else {
        const source = tabs.find(t => t.id === tab)?.table;
        if (!source) return;
        const { data, error: e } = await (source === 'mfp_evidence_app_registrations' ? supabase.from(source).select('*').order('linked_at', { ascending: false }).limit(250) : supabase.from(source).select('*').order('created_at', { ascending: false }).limit(250));
        if (e) throw e;
        setRows((data ?? []) as Row[]);
      }
    } catch (e) {
      setError((e as { message?: string })?.message || 'Could not load this section. Confirm the SQL migration has been applied and admin access is active.');
      setRows([]);
    } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { void refresh(); }, [refresh]);

  const saveSettings = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      if (!zipPassword.trim()) throw new Error('ZIP password cannot be empty.');
      const data = await invokeWebsiteApi<any>('mfp-admin-export-settings', { action: 'write', zip_password: zipPassword.trim() });
      if (data?.error) throw new Error(String(data.error));
      setNotice('Export setting saved through the authenticated administrator database operation.');
      await refresh();
    } catch (e) { setError((e as { message?: string })?.message || 'Could not save export settings.'); }
    finally { setSaving(false); }
  };

  const columns = tab === 'workItems'
    ? [{label:'Link ID', keys:['link_id','id']},{label:'Profile',keys:['profile_id']},{label:'URL',keys:['url']},{label:'Platform',keys:['platform']},{label:'Status',keys:['status']},{label:'Assigned to',keys:['assigned_to']},{label:'Batch',keys:['batch_id']},{label:'Updated',keys:['updated_at']}]
    : tab === 'activity'
    ? [{label:'Event',keys:['event_type']},{label:'User',keys:['user_id']},{label:'Link',keys:['link_id']},{label:'Platform',keys:['platform']},{label:'Metadata',keys:['metadata']},{label:'Created',keys:['created_at']}]
    : tab === 'connections'
    ? [{label:'Event',keys:['event_type']},{label:'User',keys:['user_id']},{label:'Registration',keys:['registration_id']},{label:'Metadata',keys:['metadata']},{label:'Created',keys:['created_at']}]
    : tab === 'registrations'
    ? [{label:'User ID',keys:['user_id']},{label:'Application',keys:['application_id']},{label:'Status',keys:['status']},{label:'Activation',keys:['activation_status']},{label:'Team',keys:['team_id']},{label:'Linked',keys:['linked_at']},{label:'Last seen',keys:['last_seen_at']}]
    : [];

  return <div className="space-y-5">
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2 text-emerald-300"><Activity className="h-4 w-4"/><span className="text-xs font-bold uppercase tracking-[.18em]">Admin-only operations</span></div><h2 className="mt-2 text-2xl font-bold">MF Evidence Control Center</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Review synced Evidence work items, activity and connection events, device registrations, and private website export settings. Screenshot files remain in the encrypted local Evidence export; this page shows only metadata that has been synced.</p></div><button onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Refresh</button></div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{tabs.map(item => { const Icon=item.icon; return <button key={item.id} onClick={()=>setTab(item.id)} className={`flex min-h-[74px] flex-col items-start justify-between rounded-2xl border p-3 text-left transition ${tab===item.id?'border-emerald-300/60 bg-emerald-300/15':'border-white/10 bg-white/[.04] hover:bg-white/[.08]'}`}><Icon className="h-4 w-4 text-emerald-200"/><span className="text-xs font-semibold">{item.label}</span></button>; })}</div>
    </section>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {tab === 'settings' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="font-bold text-slate-900">Private website ZIP export setting</h3><p className="mt-1 text-sm text-slate-500">This value is stored in a private database table and is not exposed through public config. It does not change the unchanged Android app's legacy export setting.</p><label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="zip-password">Website ZIP export password</label><input id="zip-password" type="password" autoComplete="new-password" value={zipPassword} onChange={e=>setZipPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter a website-only ZIP export password"/><div className="mt-4 flex flex-wrap gap-3"><button onClick={()=>void saveSettings()} disabled={saving || loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Saving…':'Save setting'}</button><button onClick={()=>void refresh()} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Reload current value</button></div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Security note: this website-only setting is private. The unchanged Android app still uses its existing legacy setting; do not assume changing this value changes Android export behavior.</p></section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5"><div><h3 className="font-bold text-slate-900">{tabs.find(t=>t.id===tab)?.label}</h3><p className="mt-1 text-xs text-slate-500">Latest {rows.length} records · maximum 250 per refresh</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} records</span></div>{loading ? <div className="p-10 text-center text-sm text-slate-500">Loading records…</div> : rows.length===0 ? <div className="p-10 text-center"><p className="font-semibold text-slate-700">No records yet</p><p className="mt-1 text-sm text-slate-500">Records appear after the Android app syncs supported metadata to this Supabase project.</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map(c=><th key={c.label} className="whitespace-nowrap px-4 py-3 font-semibold">{c.label}</th>)}<th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row,i)=><tr key={String(first(row,['id','operation_id','export_id','screenshot_id','user_id'])??i)} className="align-top hover:bg-slate-50/70">{columns.map(c=><td key={c.label} className="max-w-[240px] break-all px-4 py-3 text-slate-700">{pretty(first(row,c.keys))}</td>)}<td className="max-w-[360px] px-4 py-3"><details><summary className="cursor-pointer text-xs font-semibold text-blue-700">View raw metadata</summary><pre className="mt-2 max-w-[360px] overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-4 text-slate-100">{JSON.stringify(row,null,2)}</pre></details></td></tr>)}</tbody></table></div>}</section>}
  </div>;
};
