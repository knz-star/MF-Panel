import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Link2, RefreshCw, ShieldAlert, Smartphone, TrendingUp, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAdminEvidencePerformance, getEvidencePerformance, type AdminEvidencePerformance, type EvidencePerformance, type EvidencePeriod } from '../../services/evidencePerformanceService';

const periods: Array<{ value: EvidencePeriod; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'days7', label: '7 days' },
  { value: 'days14', label: '14 days' },
  { value: 'monthly', label: '30 days' },
  { value: 'days90', label: '90 days' },
];
const scoreLabel = (score: number | null) => score === null ? 'Awaiting work outcomes' : `${score.toFixed(1)}%`;
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString() : 'No sync recorded';

export const EvidencePerformanceDashboard: React.FC = () => {
  const { isAdmin, userProfile } = useAuth();
  const [period, setPeriod] = useState<EvidencePeriod>('monthly');
  const [mine, setMine] = useState<EvidencePerformance | null>(null);
  const [adminData, setAdminData] = useState<AdminEvidencePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const tasks: Promise<any>[] = [getEvidencePerformance(period)];
      if (isAdmin) tasks.push(getAdminEvidencePerformance(period));
      const result = await Promise.all(tasks);
      setMine(result[0]); setAdminData(isAdmin ? result[1] : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Evidence analytics.');
    } finally { if (!silent) setLoading(false); }
  }, [period, isAdmin]);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { void refresh(true); }, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const scoreColor = mine?.score === null || mine?.score === undefined ? 'text-slate-500' : mine.score < 25 ? 'text-rose-700' : mine.score < 60 ? 'text-amber-700' : 'text-emerald-700';
  const scoreBg = mine?.score === null || mine?.score === undefined ? 'bg-slate-100' : mine.score < 25 ? 'bg-rose-50' : mine.score < 60 ? 'bg-amber-50' : 'bg-emerald-50';
  const maxBar = Math.max(1, ...(mine?.series || []).map(x => Math.max(x.assigned, x.completed, x.failed)));
  const visibleSeries = (mine?.series || []).slice(-(period === 'days90' ? 30 : 14));

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2 text-emerald-300"><Activity className="h-4 w-4"/><p className="text-[11px] font-bold uppercase tracking-[.18em]">MF Evidence · Performance</p></div><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Work & activity analytics</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Assigned, completed, pending links, platform breakdown and the rolling activity score from synced application events.</p></div>
        <div className="flex flex-wrap gap-2"><Link to="/evidence/assignments" className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/20"><ClipboardList className="h-4 w-4"/> Assignment queue</Link><Link to="/dashboard/evidence-linking" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"><Smartphone className="h-4 w-4"/> App linking</Link><button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Refresh</button></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">{periods.map(p => <button key={p.value} onClick={() => setPeriod(p.value)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${period === p.value ? 'bg-emerald-300 text-slate-950' : 'border border-white/15 text-slate-300 hover:bg-white/10'}`}>{p.label}</button>)}</div>
    </section>

    {error && <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-bold">Analytics could not load</p><p className="mt-1">{error}</p><p className="mt-2 text-xs">Confirm that the Evidence performance migration and `mfp-evidence-performance` database operation are deployed.</p></div></div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Metric icon={Link2} label="Total assigned" value={loading ? '—' : mine?.activeAssigned ?? 0} hint="Currently assigned to you" tone="blue"/>
      <Metric icon={CheckCircle2} label="Completed links" value={loading ? '—' : mine?.completed ?? 0} hint="Unique completed outcomes" tone="green"/>
      <Metric icon={Clock3} label="Pending links" value={loading ? '—' : mine?.pending ?? 0} hint="Still assigned to you" tone="amber"/>
      <Metric icon={TrendingUp} label="Score rate" value={loading ? '—' : scoreLabel(mine?.score ?? null)} hint="Completed ÷ completed + failed" tone={mine?.score !== null && mine?.score !== undefined && mine.score < 25 ? 'red' : 'slate'}/>
      <Metric icon={Smartphone} label="App status" value={loading ? '—' : mine?.registrationStatus === 'ACTIVE' && mine?.activationStatus === 'ACTIVE' ? 'Linked' : 'Not linked'} hint={dateLabel(mine?.lastSeenAt ?? null)} tone={mine?.registrationStatus === 'ACTIVE' ? 'green' : 'slate'}/>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">Activity trend</h3><p className="mt-1 text-xs text-slate-500">Recent activity buckets · selected range</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{periods.find(x => x.value === period)?.label}</span></div>
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading activity…</p> : visibleSeries.length === 0 ? <Empty text="No activity has synced from the Android app yet."/> : <div className="mt-6 space-y-3">{visibleSeries.map(point => <div key={point.date} className="grid grid-cols-[74px_1fr] items-center gap-3"><span className="truncate text-[10px] text-slate-500">{point.date}</span><div className="flex h-5 items-center gap-1"><div title={`Assigned: ${point.assigned}`} className="h-3 rounded-r bg-blue-500" style={{width: `${Math.max(point.assigned ? 2 : 0, point.assigned / maxBar * 100)}%`}}/><div title={`Completed: ${point.completed}`} className="h-3 rounded-r bg-emerald-500" style={{width: `${Math.max(point.completed ? 2 : 0, point.completed / maxBar * 100)}%`}}/><div title={`Failed: ${point.failed}`} className="h-3 rounded-r bg-rose-400" style={{width: `${Math.max(point.failed ? 2 : 0, point.failed / maxBar * 100)}%`}}/></div></div>)}</div>}
        <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><Legend color="bg-blue-500" label="Assigned"/><Legend color="bg-emerald-500" label="Completed"/><Legend color="bg-rose-400" label="Failed"/></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">Platform breakdown</h3><p className="mt-1 text-xs text-slate-500">Assigned and outcome counts by platform</p></div><span className="text-xs text-slate-400">{Object.keys(mine?.platformCounts || {}).length} platforms</span></div>
        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading platforms…</p> : Object.keys(mine?.platformCounts || {}).length === 0 ? <Empty text="Platform totals appear after the app syncs assigned links."/> : <div className="mt-4 space-y-3">{Object.entries(mine!.platformCounts).sort((a,b) => b[1].assigned-a[1].assigned).map(([platform, count]) => <div key={platform} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{platform}</p><p className="font-mono text-sm font-bold">{count.assigned}</p></div><div className="mt-2 grid grid-cols-3 gap-2 text-[10px]"><span className="text-emerald-700">Completed: {count.completed}</span><span className="text-amber-700">Pending: {count.pending}</span><span className="text-slate-500">Returned: {count.returned}</span></div></div>)}</div>}
      </section>
    </div>

    <section className={`rounded-2xl border p-4 sm:p-5 ${mine?.score !== null && mine?.score !== undefined && mine.score < 25 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${scoreBg} ${scoreColor}`}>{mine?.score !== null && mine?.score !== undefined && mine.score < 25 ? <ShieldAlert className="h-5 w-5"/> : <Activity className="h-5 w-5"/>}</div><div className="min-w-0 flex-1"><h3 className="font-bold text-slate-950">Activity status & score policy</h3><p className="mt-1 text-sm leading-6 text-slate-600">{mine?.score === null || mine?.score === undefined ? 'Score starts after completed or failed work outcomes sync. Pending links alone do not lower the score.' : mine.score < 25 ? 'Score is below 25%. On the next qualifying sync, the backend returns assigned links to the pool, preserves activity history, revokes Evidence access and invalidates sessions.' : mine.score < 60 ? 'Score needs improvement. Complete assigned work and sync outcomes regularly.' : 'Score is on track for the selected reporting period.'}</p><p className="mt-2 text-xs text-slate-500">Score formula: completed outcomes ÷ (completed + failed outcomes). Automatic action applies when the rolling 30-day score is below 25% after at least one completed or failed outcome. Untouched pending links alone do not lower the score.</p></div><div className={`rounded-xl px-3 py-2 text-right ${scoreBg}`}><p className={`text-xl font-extrabold ${scoreColor}`}>{loading ? '—' : scoreLabel(mine?.score ?? null)}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Current score</p></div></div>
    </section>

    {isAdmin && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">Evidence team overview</h3><p className="mt-1 text-xs text-slate-500">User-level score and assignment status for {periods.find(x => x.value === period)?.label.toLowerCase()}.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{adminData?.totals.users ?? 0} users</span></div><div className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">Assigned</p><p className="mt-1 text-xl font-bold">{adminData?.totals.assigned ?? 0}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] uppercase tracking-wide text-emerald-700">Completed</p><p className="mt-1 text-xl font-bold text-emerald-800">{adminData?.totals.completed ?? 0}</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] uppercase tracking-wide text-amber-700">Pending</p><p className="mt-1 text-xl font-bold text-amber-800">{adminData?.totals.pending ?? 0}</p></div></div>{!adminData?.users.length ? <Empty text="No Evidence team users or synced activity found yet."/> : <div className="mt-4 space-y-3">{adminData.users.map(item => <article key={item.userId} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-sm font-semibold text-slate-900">{item.displayName || item.email || item.userId}</p><p className="break-all text-xs text-slate-500">{item.email} · {item.accountStatus}</p><p className="mt-1 text-xs text-slate-500">Assigned {item.assigned} · Completed {item.completed} · Pending {item.pending}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.score !== null && item.score < 25 ? 'bg-rose-100 text-rose-800' : item.score !== null && item.score < 60 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{scoreLabel(item.score)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.registrationStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.registrationStatus}</span></div></article>)}</div>}</section>}

    <p className="text-center text-[11px] leading-5 text-slate-400">Metrics are based on activity received by Supabase. If the Android application has not been updated to sync per-link events, assigned/completed/pending analytics will remain empty until that integration is added.</p>
  </div>;
};

function Metric({ icon: Icon, label, value, hint, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; hint: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' }) {
  const colors = { blue: 'bg-blue-50 text-blue-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-rose-50 text-rose-700', slate: 'bg-slate-100 text-slate-600' };
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon className="h-4 w-4"/></span></div><p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{hint}</p></article>;
}
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-slate-500">{text}</p>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${color}`}/>{label}</span>; }
