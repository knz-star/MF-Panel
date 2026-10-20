import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardPaste, RefreshCw, Users, Send, ShieldCheck, ArrowRight } from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { getCheckingQueueStats } from '../../services/checkingService';
import type { ProfileRecord } from '../../types/profile';

export const SearchingDashboard: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [queue, setQueue] = useState({ activeQueueCount: 0, capacityLimit: 500, remainingCapacity: 500 });
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const [records, stats] = await Promise.all([listProfiles({ limitCount: 10000 }), getCheckingQueueStats()]);
      setProfiles(records); setQueue(stats);
    } catch (error) { console.error('Searching counts failed to load', error); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const totalProfiles = profiles.length;
  const postedLinks = profiles.filter(p => /\/(p|reel|reels|tv|posts|post|videos?|photo|photos|status|shorts|watch|live|clip|stories|story)(\/|$)/i.test((p.canonicalUrl || '').split('?')[0])).length;
  const profileLinks = Math.max(0, totalProfiles - postedLinks);
  const reviewCount = profiles.filter(p => ['NEEDS_REVIEW','DUPLICATE','INVALID'].includes(String(p.currentWorkflowStatus || '').toUpperCase())).length;
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Searching workspace</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Paste links. We handle the rest.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Paste WhatsApp/chat text in one box. Unique links are automatically handed to Checking; duplicate or invalid links go to Admin Review. Individual URLs are hidden from Searching members.</p></div><button onClick={() => void load()} disabled={loading} aria-label="Refresh counts" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh</button></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[{label:'Profile links',value:profileLinks,icon:Users},{label:'Posted links',value:postedLinks,icon:ClipboardPaste},{label:'Auto-sent to Checking',value:queue.activeQueueCount,icon:Send},{label:'Queue slots remaining',value:queue.remainingCapacity,icon:ShieldCheck}].map(({label,value,icon:Icon})=><article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500">{label}</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-slate-600"><Icon className="h-4 w-4"/></span></div><p className="mt-3 text-3xl font-bold tabular-nums text-slate-950">{loading?'—':value.toLocaleString()}</p>{label==='Auto-sent to Checking'&&<p className="mt-1 text-[11px] text-slate-500">Capacity: {queue.capacityLimit}</p>}</article>)}
    </section>
    <Link to="/searching/import" className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950 p-5 text-white shadow-sm transition hover:bg-slate-800 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><ClipboardPaste className="h-5 w-5"/></span><div><p className="font-bold">Paste WhatsApp links</p><p className="mt-1 text-xs text-white/65">One box · automatic duplicate check · automatic handoff</p></div></div><ArrowRight className="h-5 w-5 shrink-0"/></Link>
    <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">Searching members see totals only. The actual URLs and duplicate-review records stay in the authorized Checking/Admin workspaces. Handoff is automatic; no manual handoff action is needed.</p>
  </div>;
};
