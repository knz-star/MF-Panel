import React, { useMemo, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock3, ExternalLink, Link2, Search, ShieldCheck } from 'lucide-react';
import { lookupTracker, type TrackerRecord } from '../../services/dashboardMetricsService';
import { supabase } from '../../lib/supabase';

export const GlobalTrackerView: React.FC<{ publicMode?: boolean }> = ({ publicMode = false }) => {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<TrackerRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState('');
  const [screenshotRefs, setScreenshotRefs] = useState<Array<Record<string, any>>>([]);
  const selected = records.find(r => `${r.kind}:${r.id}` === selectedId) ?? records[0];
  const events = useMemo(() => selected?.timeline ?? [], [selected]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setRecords([]); setSelectedId(''); setScreenshotRefs([]);
    try {
      const result = await lookupTracker(query, publicMode);
      setRecords(result.records ?? []);
      if (!result.records?.length) setError('No matching link found. Check the URL or ID and try again.');
      else setSelectedId(`${result.records[0].kind}:${result.records[0].id}`);
      setLoadedAt(new Date().toLocaleTimeString());
      if (!publicMode) {
        try {
          const { data } = await supabase.rpc('mfp_evidence_zip_metadata', { p_action: 'tracker', p_payload: {} });
          setScreenshotRefs(Array.isArray(data?.records) ? data.records : []);
        } catch { /* tracker still works if optional screenshot metadata is unavailable */ }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Tracker lookup failed.'); }
    finally { setBusy(false); }
  };

  const relatedScreenshots = useMemo(() => {
    if (!selected) return [];
    const url = selected.url.toLowerCase();
    return screenshotRefs.filter(x => String(x.canonical_url ?? '').toLowerCase() === url || String(x.source_profile_id ?? '').toLowerCase() === selected.id.toLowerCase() || String(x.mfp_profile_id ?? '').toLowerCase() === String(selected.profileId ?? selected.publicId).toLowerCase());
  }, [selected, screenshotRefs]);

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-3xl bg-[#2A2723] p-5 text-white shadow-sm sm:p-7"><div className="flex items-center gap-2 text-[#E8B87C]"><Link2 className="h-4 w-4"/><span className="text-[11px] font-bold uppercase tracking-[.18em]">MF MPanel · Link tracking</span></div><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{publicMode ? 'Public Global Tracker' : 'Global Tracker & Roadmap'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#E9E2D6]">Search a full URL, MFP / PRF / PST / SRC ID. See recorded workflow stages and the next stage that has not yet been recorded. We never invent timestamps or claim an unrecorded step is complete.</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} required minLength={publicMode?5:4} placeholder="Paste URL or enter link ID…" className="min-h-12 w-full rounded-xl border border-white/15 bg-white px-4 pl-10 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-[#E8B87C]"/></div><button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-[#C8853F] px-5 text-sm font-bold text-white disabled:opacity-50">{busy?'Searching…':'Find roadmap'}</button></form>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#E9E2D6]">{records.length>0&&<span className="rounded-full bg-white/10 px-3 py-1.5">Matches: {records.length}</span>}{loadedAt&&<span className="px-2 py-1.5">Updated {loadedAt}</span>}{publicMode&&<span className="px-2 py-1.5">Public view hides staff identities and internal notes</span>}</div>
    </header>
    {error&&<div role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertCircle className="h-5 w-5 shrink-0"/>{error}</div>}
    {records.length>0&&<div className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
      <section className="overflow-hidden rounded-2xl border border-[#E2D9C8] bg-white"><div className="border-b border-[#F0E3D0] p-4"><h2 className="font-bold text-[#1F2421]">Matching links</h2><p className="mt-1 text-xs text-[#716D64]">{records.length} record(s) returned from the full database lookup.</p></div><div className="max-h-[640px] divide-y divide-[#F0E3D0] overflow-y-auto">{records.map(r=><button key={`${r.kind}:${r.id}`} onClick={()=>setSelectedId(`${r.kind}:${r.id}`)} className={`block w-full p-4 text-left transition hover:bg-[#FBF7EF] ${selected?.id===r.id&&selected?.kind===r.kind?'bg-[#F6F1E8]':''}`}><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-[#F6F1E8] px-2 py-1 text-[10px] font-bold uppercase text-[#716D64]">{r.kind}</span><span className="text-[10px] font-semibold text-[#716D64]">{r.status.replaceAll('_',' ')}</span></div><p className="mt-2 break-all font-mono text-xs font-bold text-[#8B5628]">{r.publicId}</p><p className="mt-1 break-all text-xs text-[#716D64]">{r.url}</p><p className="mt-2 text-[10px] text-[#8A8176]">Created {r.createdAt?new Date(r.createdAt).toLocaleString():'time unavailable'}</p></button>)}</div></section>
      {selected&&<section className="rounded-2xl border border-[#E2D9C8] bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F6F1E8] text-[#C8853F]"><Activity className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-[#C8853F]">Selected roadmap</p><h2 className="mt-1 break-all font-mono text-sm font-bold text-[#1F2421]">{selected.publicId}</h2><p className="mt-1 break-all text-xs text-[#716D64]">{selected.url}</p><p className="mt-2 break-all font-mono text-[10px] text-[#8A8176]">Profile ID: {selected.profileId??'—'} · {selected.kind==='post'?'Post ID':'Record ID'}: {selected.id}</p></div><a href={selected.url} target="_blank" rel="noreferrer" aria-label="Open link" className="rounded-lg border border-[#E2D9C8] p-2 text-[#716D64] hover:bg-[#FBF7EF]"><ExternalLink className="h-4 w-4"/></a></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{name:'Searching',stage:'SEARCHING'},{name:'Checking',stage:'CHECKING'},{name:'Evidence',stage:'EVIDENCE'},{name:'Report delivery',stage:'REPORTS'}].map(step=>{const done=events.some(ev=>ev.stage.toUpperCase().includes(step.stage));const next=!done&&events.every(ev=>['SEARCHING','CHECKING','EVIDENCE','REPORTS'].indexOf(ev.stage.toUpperCase()) < ['SEARCHING','CHECKING','EVIDENCE','REPORTS'].indexOf(step.stage));return <div key={step.name} className={`rounded-xl border p-3 ${done?'border-emerald-200 bg-emerald-50':next?'border-[#E8B87C] bg-[#FBF7EF]':'border-[#E2D9C8] bg-[#FBF7EF]'}`}><div className="flex items-center gap-1.5">{done?<CheckCircle2 className="h-4 w-4 text-emerald-700"/>:<Clock3 className="h-4 w-4 text-[#8A8176]"/>}<span className="text-[10px] font-bold text-[#1F2421]">{step.name}</span></div><p className="mt-2 text-[10px] text-[#716D64]">{done?'Recorded':next?'Next stage':'Not recorded'}</p></div>})}</div>
        {!publicMode&&<div className="mt-5 rounded-xl border border-[#E2D9C8] bg-[#FBF7EF] p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-bold text-[#1F2421]">Evidence screenshot IDs</h3><span className="text-[10px] text-[#716D64]">IDs/metadata only</span></div>{relatedScreenshots.length?<div className="mt-3 space-y-2">{relatedScreenshots.map((item,i)=><div key={String(item.screenshot_uid??i)} className="rounded-lg border border-[#E2D9C8] bg-white p-3 text-xs"><p className="break-all font-mono font-bold text-[#8B5628]">{item.screenshot_uid??item.screenshot_id??'Screenshot ID unavailable'}</p><p className="mt-1 break-all text-[#716D64]">Link ID: {item.link_id??'—'} · Profile ID: {item.mfp_profile_id??item.source_profile_id??'—'}</p></div>)}</div>:<p className="mt-2 text-xs text-[#716D64]">No screenshot ID metadata is linked to this record yet.</p>}</div>}
        <div className="mt-5 flex items-center justify-between"><h3 className="font-bold text-[#1F2421]">Recorded event timeline</h3><span className="rounded-full bg-[#F6F1E8] px-2 py-1 text-[10px] font-bold text-[#716D64]">{events.length} events</span></div>
        {events.length?<ol className="mt-4 space-y-4">{events.map((event,i)=><li key={`${event.stage}-${event.createdAt}-${i}`} className="relative flex gap-3"><span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F6F1E8] text-[#C8853F]"><ShieldCheck className="h-3.5 w-3.5"/></span>{i<events.length-1&&<span className="absolute left-[13px] top-8 h-[calc(100%+4px)] w-px bg-[#E2D9C8]"/>}<div className="min-w-0 flex-1 rounded-xl border border-[#F0E3D0] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#1F2421]">{event.action||event.stage}</p><span className="text-[10px] text-[#8A8176]">{event.createdAt?new Date(event.createdAt).toLocaleString():'Time unavailable'}</span></div><p className="mt-1 text-[11px] text-[#716D64]">{event.stage}{event.actor?` · ${event.actor}`:''}{event.previousStatus||event.newStatus?` · ${event.previousStatus??'—'} → ${event.newStatus??'—'}`:''}</p>{!publicMode&&!!event.metadata?.notes&&<p className="mt-2 text-xs leading-5 text-[#716D64]">{String(event.metadata.notes)}</p>}</div></li>)}</ol>:<p className="mt-4 rounded-xl border border-dashed border-[#E2D9C8] p-5 text-center text-sm text-[#716D64]">The link exists, but no detailed event history has been recorded yet.</p>}
        <p className="mt-4 text-[10px] leading-5 text-[#8A8176]">Only recorded events receive timestamps. A missing stage remains unrecorded rather than being guessed.</p>
      </section>}
    </div>}
  </div>;
};
