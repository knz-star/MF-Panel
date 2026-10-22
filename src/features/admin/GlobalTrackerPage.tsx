import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock3, ExternalLink, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { listAllPosts } from '../../services/postService';
import { listCheckingRecords } from '../../services/checkingService';
import { listRecentWorkflowActivity } from '../../services/workflowService';
import type { ProfileRecord } from '../../types/profile';
import type { PostRecord } from '../../types/post';
import type { CheckingRecord } from '../../types/checking';
import type { WorkflowEvent } from '../../types/workflow';
import { supabase } from '../../lib/supabase';

type TrackerResult = { kind: 'profile' | 'post'; id: string; publicId: string; parentId: string; url: string; platform: string; status: string; createdAt: string; updatedAt: string; profile?: ProfileRecord; post?: PostRecord };
const clean = (value: unknown) => String(value ?? '').trim().toLowerCase();
const statusLabel = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const stageFor = (status: string) => {
  const s = status.toUpperCase();
  if (['SEARCHED', 'RECORDED'].includes(s)) return 'Searching';
  if (['QUEUED_CHECKING', 'CHECKING', 'OPEN', 'REOPEN', 'RECHECK'].includes(s)) return 'Checking';
  if (['VERIFIED', 'COMPLETE', 'COMPLETED'].includes(s)) return 'Verified';
  if (['FAILED_BLOCKED', 'BLOCKED', 'INVALID', 'FAILED'].includes(s)) return 'Blocked / Invalid';
  if (s.includes('EVIDENCE')) return 'Evidence';
  if (s.includes('REPORT')) return 'Reporting';
  return 'Workflow recorded';
};
export const GlobalTrackerPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [checks, setChecks] = useState<CheckingRecord[]>([]);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [evidenceRefs, setEvidenceRefs] = useState<Array<Record<string, any>>>([]);
  const [queryText, setQueryText] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [p, po, c, e, evidence] = await Promise.all([listProfiles({ limitCount: 1000 }), listAllPosts(1000), listCheckingRecords(undefined, 1000), listRecentWorkflowActivity(1000), supabase.rpc('mfp_evidence_zip_metadata', { p_action: 'tracker', p_payload: {} })]);
      if (evidence.error) throw evidence.error;
      setProfiles(p); setPosts(po); setChecks(c); setEvents(e); setEvidenceRefs(Array.isArray(evidence.data?.records) ? evidence.data.records : []); setLoadedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(e instanceof Error ? e.message : 'Global tracker data could not be loaded.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const results = useMemo<TrackerResult[]>(() => [
    ...profiles.map(p => ({ kind: 'profile' as const, id: p.profileId, publicId: p.mfpProfileId || p.profileId, parentId: '—', url: p.canonicalUrl || p.originalUrl || '', platform: p.platform || 'UNKNOWN', status: p.currentWorkflowStatus || 'SEARCHED', createdAt: p.createdAt || '', updatedAt: p.updatedAt || p.createdAt || '', profile: p })),
    ...posts.map(p => ({ kind: 'post' as const, id: p.postId, publicId: p.mfpPostId || p.postId, parentId: p.mfpProfileId || p.profileId || '', url: p.canonicalUrl || p.originalUrl || '', platform: p.platform || 'UNKNOWN', status: checks.find(c => c.profileId === p.profileId)?.outcome || 'POST_RECORDED', createdAt: p.createdAt || '', updatedAt: p.updatedAt || p.createdAt || '', post: p })),
  ].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), [profiles, posts, checks]);
  const matches = useMemo(() => {
    const q = clean(queryText);
    if (!q) return [];
    const compactQ = q.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return results.filter(r => [r.id, r.publicId, r.parentId, r.url, r.platform, r.status, r.profile?.srcReferences?.join(' '), r.post?.profileId, ...evidenceRefs.filter(x => clean(x.canonical_url).includes(compactQ) || clean(x.source_profile_id).includes(q) || clean(x.mfp_profile_id).includes(q) || clean(x.link_id).includes(q) || (Array.isArray(x.post_ids) && x.post_ids.some((id: string) => clean(id).includes(q)))).flatMap(x => [x.screenshot_uid, x.link_id, x.source_profile_id, x.mfp_profile_id, ...(x.post_ids ?? [])])].some(v => {
      const value = clean(v);
      return value.includes(q) || value.includes(compactQ) || (q.startsWith('http') && value.replace(/^https?:\/\//, '').includes(compactQ));
    })).slice(0, 100);
  }, [results, queryText, evidenceRefs]);
  const selected = results.find(r => `${r.kind}:${r.id}` === selectedKey) || matches[0];
  const timeline = useMemo(() => {
    if (!selected) return [];
    const profileId = selected.kind === 'profile' ? selected.id : selected.parentId;
    const related = events.filter(e => clean(e.profileId) === clean(profileId) || clean(e.postId) === clean(selected.id) || clean(e.postId) === clean(selected.publicId));
    const checkEvents = checks.filter(c => clean(c.profileId) === clean(profileId)).map(c => ({ eventId: c.checkingRecordId, profileId: c.profileId, stage: 'CHECKING', action: c.outcome, previousStatus: '', newStatus: c.outcome, actorUid: c.checkedBy || '', actorEmail: c.checkedByEmail || c.checkedBy, createdAt: c.checkedAt, metadata: { notes: c.notes, region: c.region } } as WorkflowEvent));
    const base = selected.kind === 'profile' && selected.profile ? [{ eventId: `created-${selected.id}`, profileId, stage: 'SEARCHING' as const, action: 'Profile record created', newStatus: selected.status, createdAt: selected.createdAt, actorUid: selected.profile.createdBy || '', actorEmail: selected.profile.createdBy } as WorkflowEvent] : [];
    return [...related, ...checkEvents, ...base].sort((a,b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [selected, events, checks]);
  const selectedEvidenceRefs = useMemo(() => {
    if (!selected) return [];
    const profileId = selected.kind === 'profile' ? selected.id : selected.parentId;
    const publicProfileId = selected.kind === 'profile' ? selected.publicId : selected.parentId;
    return evidenceRefs.filter((item) =>
      clean(item.canonical_url) === clean(selected.url) ||
      clean(item.source_profile_id) === clean(profileId) ||
      clean(item.mfp_profile_id) === clean(publicProfileId) ||
      (selected.kind === 'post' && (item.post_ids ?? []).some((id: string) => clean(id) === clean(selected.id) || clean(id) === clean(selected.publicId)))
    );
  }, [selected, evidenceRefs]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); setSelectedKey(''); };
  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-300">MF MPanel · Global workflow</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Global Tracker & Roadmap</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Search by full URL, MFP ID, PRF/PST ID, SRC reference or parent profile ID. Follow the recorded workflow timeline from Searching to Checking and final outcomes.</p></div><button onClick={() => void load()} disabled={busy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`}/>{busy ? 'Refreshing…' : 'Refresh tracker'}</button></div><form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={queryText} onChange={e => { setQueryText(e.target.value); setSelectedKey(''); }} placeholder="Paste URL or enter MFP / PRF / PST / SRC ID…" className="min-h-12 w-full rounded-xl border border-white/15 bg-white px-4 pl-10 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-blue-300"/></div><button type="submit" className="min-h-12 rounded-xl bg-blue-400 px-5 text-sm font-bold text-slate-950">Find roadmap</button></form><div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-300"><span className="rounded-full bg-white/10 px-3 py-1.5">Profiles: {profiles.length}</span><span className="rounded-full bg-white/10 px-3 py-1.5">Posts: {posts.length}</span><span className="rounded-full bg-white/10 px-3 py-1.5">Checking outcomes: {checks.length}</span><span className="rounded-full bg-white/10 px-3 py-1.5">Events loaded: {events.length}</span><span className="rounded-full bg-white/10 px-3 py-1.5">Screenshot IDs: {evidenceRefs.length}</span>{loadedAt && <span className="px-2 py-1.5">Updated {loadedAt}</span>}</div></header>
    {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-5 w-5 shrink-0"/>{error}</div>}
    {busy && !results.length ? <div className="rounded-2xl border bg-white p-12 text-center text-sm text-slate-500">Loading workflow records from Supabase…</div> : queryText.trim() && !matches.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-bold text-amber-950">No matching record found in the loaded data.</p><p className="mt-1 text-sm leading-6 text-amber-900">Check the ID spelling or URL. The tracker does not fabricate a roadmap; if the record exists beyond the loaded limit or is missing from Supabase, it needs a backend lookup.</p></div> : matches.length > 0 ? <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h3 className="font-bold text-slate-950">Matching records</h3><p className="mt-1 text-xs text-slate-500">{matches.length} result(s); select a record to inspect its roadmap.</p></div><div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto">{matches.map(r=><button key={`${r.kind}:${r.id}`} onClick={() => setSelectedKey(`${r.kind}:${r.id}`)} className={`block w-full p-4 text-left transition hover:bg-slate-50 ${selectedKey === `${r.kind}:${r.id}` ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}><div className="flex items-start justify-between gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{r.kind}</span><span className="text-[10px] font-semibold text-slate-500">{statusLabel(r.status)}</span></div><p className="mt-2 break-all font-mono text-xs font-bold text-blue-800">{r.publicId}</p><p className="mt-1 break-all text-xs text-slate-600">{r.url}</p><p className="mt-2 text-[10px] text-slate-400">Updated {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : 'date unavailable'}</p></button>)}</div></section>
    {selected && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Activity className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Selected roadmap</p><h3 className="mt-1 break-all font-mono text-sm font-bold text-slate-950">{selected.publicId}</h3><p className="mt-1 break-all text-xs text-slate-500">{selected.url}</p><p className="mt-2 break-all font-mono text-[10px] text-slate-400">Profile ID: {selected.kind === 'profile' ? selected.id : selected.parentId} · Post ID: {selected.kind === 'post' ? selected.id : '—'}</p></div><a href={selected.url} target="_blank" rel="noreferrer" aria-label="Open URL" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ExternalLink className="h-4 w-4"/></a></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{name:'Searching',done:true},{name:'Checking',done:['CHECKING','QUEUED_CHECKING','VERIFIED','FAILED_BLOCKED','BLOCKED','INVALID'].includes(selected.status.toUpperCase()) || timeline.length>1},{name:'Final outcome',done:['VERIFIED','FAILED_BLOCKED','BLOCKED','INVALID'].includes(selected.status.toUpperCase()) || checks.some(c => clean(c.profileId) === clean(selected.kind === 'profile' ? selected.id : selected.parentId))},{name:'Evidence / report',done:timeline.some(e => /evidence|report/i.test(`${e.stage} ${e.action}`))}].map(step=><div key={step.name} className={`rounded-xl border p-3 ${step.done?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'}`}><div className="flex items-center gap-1.5">{step.done?<CheckCircle2 className="h-4 w-4 text-emerald-700"/>:<Clock3 className="h-4 w-4 text-slate-400"/>}<span className={`text-[10px] font-bold ${step.done?'text-emerald-900':'text-slate-500'}`}>{step.name}</span></div><p className={`mt-2 text-[10px] ${step.done?'text-emerald-800':'text-slate-500'}`}>{step.done?'Recorded':'No event found'}</p></div>)}</div><div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"><div className="flex items-center justify-between gap-2"><h4 className="font-bold text-indigo-950">Evidence screenshot IDs</h4><span className="text-[10px] text-indigo-700">IDs/metadata only · no image bytes stored</span></div>{selectedEvidenceRefs.length ? <div className="mt-3 space-y-2">{selectedEvidenceRefs.map((item, i) => <div key={String(item.screenshot_uid || i)} className="rounded-lg border border-indigo-100 bg-white p-3 text-xs"><p className="break-all font-mono font-bold text-indigo-900">{item.screenshot_uid}</p><p className="mt-1 break-all text-slate-600">Link ID: {item.link_id || '—'} · Profile ID: {item.mfp_profile_id || item.source_profile_id || '—'}</p><p className="mt-1 break-all text-slate-600">Post IDs: {(item.post_ids || []).join(', ') || 'Not available'}</p><p className="mt-1 break-all text-slate-600">Assigned to: {item.assigned_to_name || item.assigned_to_email || 'Unknown'} · Status: {item.verification_status || 'NEEDS_REVIEW'}</p>{item.canonical_url && <a href={item.canonical_url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-blue-700 underline">{item.canonical_url}</a>}</div>)}</div> : <p className="mt-2 text-xs text-indigo-800">No screenshot ID metadata is linked to this record yet.</p>}</div><div className="mt-5 flex items-center justify-between"><h4 className="font-bold text-slate-950">Recorded event timeline</h4><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{timeline.length} events</span></div>{timeline.length ? <ol className="mt-4 space-y-4">{timeline.map((event,i)=><li key={`${event.eventId}-${i}`} className="relative flex gap-3"><span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><ShieldCheck className="h-3.5 w-3.5"/></span>{i<timeline.length-1&&<span className="absolute left-[13px] top-8 h-[calc(100%+4px)] w-px bg-slate-200"/>}<div className="min-w-0 flex-1 rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{event.action || statusLabel(event.newStatus || 'Workflow event')}</p><span className="text-[10px] text-slate-400">{event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Time unavailable'}</span></div><p className="mt-1 text-[11px] text-slate-500">{event.stage} · {event.actorEmail || 'Actor not recorded'}{event.previousStatus || event.newStatus ? ` · ${event.previousStatus || '—'} → ${event.newStatus || '—'}` : ''}</p>{event.metadata?.notes && <p className="mt-2 text-xs leading-5 text-slate-600">{String(event.metadata.notes)}</p>}</div></li>)}</ol> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center"><AlertCircle className="mx-auto h-5 w-5 text-slate-400"/><p className="mt-2 text-sm font-semibold text-slate-700">No detailed event history recorded</p><p className="mt-1 text-xs leading-5 text-slate-500">The record exists, but its previous workflow events are not available in the event data currently loaded. Current status and known checking outcomes are shown above.</p></div>}<p className="mt-4 text-[10px] leading-5 text-slate-400">Tracker only shows records and events returned by the authorized data layer. Missing stages are marked “No event found” instead of being guessed.</p></section>}</div> : queryText.trim() ? null : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Search className="mx-auto h-7 w-7 text-slate-400"/><h3 className="mt-3 font-bold text-slate-950">Search a URL or ID to see its roadmap</h3><p className="mt-1 text-sm text-slate-500">Try a full URL, MFP public ID, internal PRF/PST ID or SRC reference.</p></div>}
  </div>;
};
