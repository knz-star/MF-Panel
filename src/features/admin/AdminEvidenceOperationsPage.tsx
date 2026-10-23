import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Archive, Camera, RefreshCw, Smartphone, Settings2, Workflow, Save, ShieldAlert, KeyRound, Sparkles } from 'lucide-react';
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
  const [zipCodes, setZipCodes] = useState<Array<{label:string;password:string}>>(Array.from({length:5},(_,i)=>({label:`Code ${i+1}`,password:''})));
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      if (tab === 'settings') {
        const { data, error: e } = await supabase.rpc('mfp_get_evidence_zip_passwords');
        if (e) throw e;
        const saved = Array.isArray(data) ? data : [];
        setZipCodes(Array.from({length:5},(_,i)=>({label:String(saved[i]?.label || `Code ${i+1}`),password:String(saved[i]?.password || '')}))); 
        setRows([{ key: 'export_settings', value: { configured: saved.filter((x:any)=>typeof x?.password==='string'&&x.password.length>0).length===5 } }]);
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
      if (zipCodes.length !== 5 || zipCodes.some(c=>!c.label.trim() || c.password.trim().length<8 || c.password.trim().length>128)) throw new Error('Fill all five code slots. Each label is required and every password must be 8–128 characters.');
      if (new Set(zipCodes.map(c=>c.password.trim())).size !== 5) throw new Error('All five ZIP codes must be unique.');
      const { data, error: e } = await supabase.rpc('mfp_admin_set_evidence_zip_passwords', { p_codes: zipCodes.map(c=>({label:c.label.trim(),password:c.password.trim()})) });
      if (e) throw e;
      if ((data as any)?.success !== true) throw new Error('Supabase did not confirm that the five codes were saved.');
      await refresh();
      setNotice('All five ZIP codes saved securely in Supabase. Analysis will test them one by one and record the matching slot for each ZIP.');
    } catch (e) { setError((e as { message?: string })?.message || 'Could not save ZIP codes. Apply the five-code Supabase migration and confirm active Admin access.'); }
    finally { setSaving(false); }
  };

  const generateCodes = async () => {
    setGeneratingCodes(true); setError(''); setNotice('');
    try {
      const { data, error: e } = await supabase.rpc('mfp_admin_generate_evidence_zip_passwords');
      if (e) throw e;
      if (!Array.isArray(data) || data.length !== 5) throw new Error('Supabase did not return exactly five codes.');
      setZipCodes(data.map((c:any,i:number)=>({label:String(c.label||`Code ${i+1}`),password:String(c.password||'')})));
      setNotice('Supabase generated five unique codes. Review or replace any slot with your own custom code, then press Save five codes.');
    } catch (e) { setError((e as { message?: string })?.message || 'Could not generate codes. Apply the five-code Supabase migration first.'); }
    finally { setGeneratingCodes(false); }
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
    {tab === 'settings' ? <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold text-slate-900">Five ZIP password codes</h3><p className="mt-1 text-sm text-slate-500">Exactly five slots are stored in private Supabase settings. You can generate codes securely on Supabase or replace any slot with your own custom code.</p></div><button onClick={()=>void generateCodes()} disabled={generatingCodes||saving||loading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 disabled:opacity-50"><Sparkles className="h-4 w-4"/>{generatingCodes?'Generating…':'Generate 5 codes'}</button></div><div className="mt-5 space-y-3">{zipCodes.map((code,i)=><div key={i} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,2fr)]"><div><label className="block text-xs font-semibold text-slate-600" htmlFor={`zip-code-label-${i}`}>Slot {i+1} label</label><input id={`zip-code-label-${i}`} value={code.label} maxLength={40} onChange={e=>setZipCodes(old=>old.map((x,j)=>i===j?{...x,label:e.target.value}:x))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" placeholder={`Code ${i+1}`}/></div><div><label className="block text-xs font-semibold text-slate-600" htmlFor={`zip-code-value-${i}`}>Custom ZIP code / password</label><div className="relative mt-1"><KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input id={`zip-code-value-${i}`} type="text" autoComplete="off" spellCheck={false} value={code.password} onChange={e=>setZipCodes(old=>old.map((x,j)=>i===j?{...x,password:e.target.value}:x))} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm" placeholder="Enter custom code (8–128 characters)"/></div></div></div>)}</div><div className="mt-4 flex flex-wrap gap-3"><button onClick={()=>void saveSettings()} disabled={saving||loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Saving…':'Save five codes'}</button><button onClick={()=>void refresh()} disabled={loading} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Reload saved codes</button></div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Codes are visible only to an active senior Admin through the protected RPC so the Admin can use them when creating ZIPs. The Android app source is not changed by this website feature. Generate or edit codes, then save them before ZIP analysis.</p></section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5"><div><h3 className="font-bold text-slate-900">{tabs.find(t=>t.id===tab)?.label}</h3><p className="mt-1 text-xs text-slate-500">Latest {rows.length} records · maximum 250 per refresh</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{rows.length} records</span></div>{loading ? <div className="p-10 text-center text-sm text-slate-500">Loading records…</div> : rows.length===0 ? <div className="p-10 text-center"><p className="font-semibold text-slate-700">No records yet</p><p className="mt-1 text-sm text-slate-500">Records appear after the Android app syncs supported metadata to this Supabase project.</p></div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map(c=><th key={c.label} className="whitespace-nowrap px-4 py-3 font-semibold">{c.label}</th>)}<th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row,i)=><tr key={String(first(row,['id','operation_id','export_id','screenshot_id','user_id'])??i)} className="align-top hover:bg-slate-50/70">{columns.map(c=><td key={c.label} className="max-w-[240px] break-all px-4 py-3 text-slate-700">{pretty(first(row,c.keys))}</td>)}<td className="max-w-[360px] px-4 py-3"><details><summary className="cursor-pointer text-xs font-semibold text-blue-700">View raw metadata</summary><pre className="mt-2 max-w-[360px] overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] leading-4 text-slate-100">{JSON.stringify(row,null,2)}</pre></details></td></tr>)}</tbody></table></div>}</section>}
  </div>;
};
