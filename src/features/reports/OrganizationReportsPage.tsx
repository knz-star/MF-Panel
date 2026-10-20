import React, { useCallback, useEffect, useState } from 'react';
import { CalendarRange, Download, FileText, RefreshCw, Share2, Users, Link2, Activity, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { collection, db, getDocs } from '../../lib/supabaseDocumentStore';
import { useAuth } from '../auth/AuthContext';

type Period = 'daily' | 'weekly' | 'fortnight' | 'monthly' | 'custom';
type TeamKey = 'searching' | 'checking' | 'reports' | 'evidence';
type GenderGroup = 'male' | 'female';
type Report = Record<string, any>;
const TEAMS: { key: TeamKey; label: string }[] = [{ key: 'searching', label: 'Searching Team' }, { key: 'checking', label: 'Checking Team' }, { key: 'reports', label: 'Reports Team' }, { key: 'evidence', label: 'Evidence Team' }];
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

export const OrganizationReportsPage: React.FC = () => {
  const { currentUser, userProfile, isAdmin, isTeamAdmin } = useAuth();
  const [period, setPeriod] = useState<Period>('daily');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [title, setTitle] = useState('');
  const [shareTeams, setShareTeams] = useState<TeamKey[]>(['searching', 'checking', 'reports', 'evidence']);
  const [shareGenderGroups, setShareGenderGroups] = useState<GenderGroup[]>(['male', 'female']);
  const [report, setReport] = useState<Report | null>(null);
  const [savedReports, setSavedReports] = useState<Report[]>([]);
  const [selectedSaved, setSelectedSaved] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSaved = useCallback(async () => {
    setLoadingSaved(true);
    try {
      const snapshot = await getDocs(collection(db, 'organizationReports'));
      const records = snapshot.docs.map((doc: any) => doc.data()).filter((item: any) => item && item.reportId && (!isAdmin || !String(item.scope || '').endsWith('_SHARED_COPY'))).sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setSavedReports(records);
    } catch (err) {
      console.warn('Shared organization reports could not be loaded.', err);
      setSavedReports([]);
    } finally { setLoadingSaved(false); }
  }, [isAdmin]);
  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const updatePeriod = (next: Period) => {
    setPeriod(next);
    const end = today(); setEndDate(end);
    if (next === 'daily') setStartDate(end);
    else if (next === 'weekly') setStartDate(daysAgo(7));
    else if (next === 'fortnight') setStartDate(daysAgo(14));
    else if (next === 'monthly') setStartDate(daysAgo(30));
  };

  const generate = async () => {
    setBusy(true); setError(''); setNotice(''); setReport(null);
    try {
      if (!currentUser) throw new Error('Sign in is required.');
      if (period === 'custom' && (!startDate || !endDate || startDate > endDate)) throw new Error('Choose a valid custom date range.');
      const { data, error: invokeError } = await supabase.functions.invoke('mfp-organization-reports', { body: { action: 'generate', period, startDate, endDate, title, shareTeams, shareGenderGroups } });
      if (invokeError) throw invokeError;
      if (!data?.success || !data?.report) throw new Error(data?.error || 'Report generation did not return a saved report.');
      setReport(data.report); setNotice(`Report ${data.report.reportId} generated and saved. Shared with workspace teams: ${(data.report.sharedTeams ?? []).join(', ') || 'none'}; gender groups: ${(data.report.sharedGenderGroups ?? []).join(', ') || 'none'}. Admins can always access the private organization master.`);
      await loadSaved();
    } catch (err: any) {
      setError(err?.message || 'Could not generate report. Check the Edge Function deployment and permissions.');
    } finally { setBusy(false); }
  };
  const downloadJson = (item: Report) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.reportId || 'MF-MPanel-Organization-Report'}.json`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const shown = report ?? selectedSaved;
  const totals = shown?.totals ?? {};
  const ownTeam = userProfile?.team as TeamKey | undefined;

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">MF MPanel · Workspace Reporting</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Organization & Team Reports</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Generate daily, weekly, 14-day, monthly or custom-range summaries. Admins can see organization-wide activity; team members generate reports only for their authorized team.</p></div><button onClick={() => void loadSaved()} disabled={loadingSaved} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loadingSaved ? 'animate-spin' : ''}`} />Refresh shared reports</button></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center gap-2"><CalendarRange className="h-5 w-5 text-blue-700"/><h2 className="font-bold text-slate-950">Create report</h2></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Report period<select value={period} onChange={(e) => updatePeriod(e.target.value as Period)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly · 7 days</option><option value="fortnight">14 days</option><option value="monthly">Monthly · last 30 days</option><option value="custom">Custom date range</option></select></label><label className="block text-sm font-medium text-slate-700">Report title (optional)<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Weekly verification progress" className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"/></label></div>
        {period === 'custom' && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Start date<input type="date" value={startDate} max={endDate || today()} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3"/></label><label className="text-sm font-medium text-slate-700">End date<input type="date" value={endDate} min={startDate} max={today()} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3"/></label></div>}
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Selected range: <strong>{period === 'custom' ? `${startDate} — ${endDate}` : period === 'daily' ? today() : `${period === 'weekly' ? daysAgo(7) : period === 'fortnight' ? daysAgo(14) : daysAgo(30)} — ${today()}`}</strong>. Reports include activity counts, member summaries, link IDs, profile/post URLs and statuses where available.</div>
        {isAdmin ? <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-800">Share with teams</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{TEAMS.map((team) => <label key={team.key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={shareTeams.includes(team.key)} onChange={(e) => setShareTeams((old) => e.target.checked ? [...new Set([...old, team.key])] : old.filter((x) => x !== team.key))} className="accent-blue-600"/>{team.label}</label>)}</div><p className="mt-2 text-xs text-slate-500">Senior Admin can share across selected teams. Team members can share only within their assigned functional team. Admin can share separate, scoped copies with gender groups.</p><div className="mt-4"><p className="text-sm font-semibold text-slate-800">Share gender-group copy</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{([{key:'male',label:'Male Group'},{key:'female',label:'Female Group'}] as const).map((gender) => <label key={gender.key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={shareGenderGroups.includes(gender.key)} onChange={(e) => setShareGenderGroups((old) => e.target.checked ? [...new Set([...old, gender.key])] : old.filter((x) => x !== gender.key))} className="accent-pink-600"/>{gender.label}</label>)}</div></div></fieldset> : <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">This report will be scoped to <strong>{ownTeam || userProfile?.team || 'your authorized team'}</strong>. The backend limits sharing to your assigned functional team. Only Admin can generate an organization-wide report.</div>}
        <button onClick={() => void generate()} disabled={busy} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4"/>}{busy ? 'Generating report…' : 'Generate & Share Report'}</button>
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white"><div className="flex items-center gap-2"><Share2 className="h-5 w-5 text-emerald-300"/><h2 className="font-bold">Saved & shared</h2></div><p className="mt-2 text-sm leading-6 text-slate-300">Reports are saved in the shared workspace. Team visibility is enforced by Supabase row-level security.</p><div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Available reports</p><p className="mt-1 text-3xl font-bold">{savedReports.length}</p></div><div className="mt-4 space-y-2">{savedReports.slice(0, 5).map((saved) => <button key={saved.reportId} onClick={() => { setSelectedSaved(saved); setReport(null); }} className={`w-full rounded-xl border p-3 text-left ${shown?.reportId === saved.reportId ? 'border-emerald-300 bg-emerald-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}><span className="block truncate text-sm font-semibold">{saved.title || saved.reportId}</span><span className="mt-1 block text-[11px] text-slate-400">{saved.startDate} — {saved.endDate}</span></button>)}</div></aside>
    </section>
    {shown && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">{shown.scope || 'Shared'} report</p><h2 className="mt-1 text-xl font-bold text-slate-950">{shown.title || shown.reportId}</h2><p className="mt-1 text-xs text-slate-500">{shown.startDate} — {shown.endDate} · Created by {shown.creatorName || shown.createdByEmail || shown.createdBy}</p></div><button onClick={() => downloadJson(shown)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white"><Download className="h-4 w-4"/>Export JSON</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{[['Records', totals.records], ['Profiles', totals.profiles], ['Posts', totals.posts], ['Checks', totals.checkingRecords], ['Events', totals.workflowEvents], ['Completed', totals.completed], ['Failed', totals.failed]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{Number(value || 0).toLocaleString()}</p></div>)}</div>
      {shown.truncated && <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0"/>The query hit its safety cap. This report is marked as truncated and may not include every record in the selected period.</p>}
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-bold text-slate-900"><Users className="h-4 w-4"/>Member activity</h3><div className="mt-3 space-y-2">{(shown.members || []).slice(0, 10).map((member: any) => <div key={member.userId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{member.name}</p><p className="truncate text-xs text-slate-500">{member.email || member.team || member.userId}</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{member.activity} records</span></div>)}{!(shown.members || []).length && <p className="text-sm text-slate-500">No user activity recorded for this period.</p>}</div></div>
      <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-bold text-slate-900"><Activity className="h-4 w-4"/>Tracked links</h3><div className="mt-3 max-h-80 space-y-2 overflow-auto">{(shown.linkRecords || []).slice(0, 50).map((link: any, index: number) => <div key={`${link.documentId}-${index}`} className="rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800">{link.publicId}</span><span className="text-[10px] uppercase text-slate-500">{link.recordType}</span><span className="ml-auto text-[10px] text-slate-500">{link.status}</span></div><a href={link.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-blue-700 hover:underline">{link.url || 'URL unavailable'}</a><p className="mt-1 text-[10px] text-slate-500">{link.platform} · {link.team} · {link.createdAt ? new Date(link.createdAt).toLocaleDateString() : ''}</p></div>)}{!(shown.linkRecords || []).length && <p className="text-sm text-slate-500">No links in this report period.</p>}</div></div></div>
    </section>}
    <p className="text-center text-[11px] text-slate-400">Signed in as {currentUser?.email || 'user'}{isTeamAdmin ? ' · Team Admin' : isAdmin ? ' · Admin' : ''}. Reports show recorded data only; missing activity is not fabricated.</p>
  </div>;
};
