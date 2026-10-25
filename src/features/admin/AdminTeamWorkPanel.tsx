import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';
import { getTeamAnalytics, type TeamAnalyticsData, type ManagedTeam } from '../../services/teamAnalyticsService';
import { listAllUsers } from '../../services/userService';
import type { UserProfile } from '../../types/user';

type Period = 'daily' | 'week' | 'all';
const TEAMS: Array<{ key: ManagedTeam; label: string }> = [
  { key: 'searching', label: 'Searching Team' },
  { key: 'checking', label: 'Checking Team' },
  { key: 'reports', label: 'Reports Team' },
  { key: 'evidence', label: 'Evidence Team' },
];

interface TeamRow {
  team: ManagedTeam;
  label: string;
  maleWork: number;
  femaleWork: number;
  totalWork: number;
  completed: number;
  failed: number;
}

/**
 * Admin overview of team work: per team (Searching / Checking / Reports /
 * Evidence), split by Male / Female gender groups, with totals.
 * Periods: Daily = latest recorded day, 7 Days = last 7 recorded days,
 * All = all-time totals from the team analytics data.
 */
export const AdminTeamWorkPanel: React.FC = () => {
  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<TeamAnalyticsData | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [analytics, userList] = await Promise.all([getTeamAnalytics(14), listAllUsers(300)]);
      setData(analytics); setUsers(userList);
    } catch (err) {
      console.error('Admin team work panel failed:', err);
      setError(err instanceof Error ? err.message : 'Team work data could not load.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const genderByUser = useMemo(() => {
    const map = new Map<string, 'male' | 'female' | null>();
    for (const u of users) {
      const g = (u.genderGroup || u.gender || '').toLowerCase();
      map.set(u.uid, g === 'male' ? 'male' : g === 'female' ? 'female' : null);
    }
    return map;
  }, [users]);

  const latestDate = useMemo(() => {
    let max = '';
    for (const m of data?.members ?? []) for (const d of m.daily ?? []) if (d.date > max) max = d.date;
    return max;
  }, [data]);

  const memberPeriodWork = (m: TeamAnalyticsData['members'][number]): { work: number; completed: number; failed: number } => {
    if (period === 'all') {
      const completed = m.completed ?? 0; const failed = m.failed ?? 0;
      return { work: completed + failed, completed, failed };
    }
    const daily = m.daily ?? [];
    let entries = daily;
    if (period === 'daily') entries = daily.filter((d) => d.date === latestDate);
    if (period === 'week') {
      const cutoff = new Date(latestDate || new Date().toISOString());
      cutoff.setDate(cutoff.getDate() - 6);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      entries = daily.filter((d) => d.date >= cutoffStr && d.date <= latestDate);
    }
    const completed = entries.reduce((s, d) => s + (d.completed ?? 0), 0);
    const failed = entries.reduce((s, d) => s + (d.failed ?? 0), 0);
    return { work: completed + failed, completed, failed };
  };

  const rows: TeamRow[] = useMemo(() => TEAMS.map(({ key, label }) => {
    const row: TeamRow = { team: key, label, maleWork: 0, femaleWork: 0, totalWork: 0, completed: 0, failed: 0 };
    for (const m of data?.members ?? []) {
      if (m.team !== key) continue;
      const w = memberPeriodWork(m);
      row.totalWork += w.work; row.completed += w.completed; row.failed += w.failed;
      const g = genderByUser.get(m.userId);
      if (g === 'male') row.maleWork += w.work;
      if (g === 'female') row.femaleWork += w.work;
    }
    return row;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, genderByUser, period, latestDate]);

  const totals = useMemo(() => {
    const t = { work: 0, completed: 0, failed: 0, male: 0, female: 0, activeMembers: 0 };
    for (const r of rows) { t.work += r.totalWork; t.completed += r.completed; t.failed += r.failed; t.male += r.maleWork; t.female += r.femaleWork; }
    const active = new Set<string>();
    for (const m of data?.members ?? []) if (memberPeriodWork(m).work > 0) active.add(m.userId);
    t.activeMembers = active.size;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, data, period, latestDate]);

  const periodLabel = period === 'daily' ? `Daily${latestDate ? ` · ${latestDate}` : ''}` : period === 'week' ? 'Last 7 days' : 'All time';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-900"><BarChart3 className="h-4 w-4 text-blue-700" /> Team Work — Male / Female Teams</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Har team ka kaam gender group ke hisaab se, total numbers ke saath. Work = completed + failed links. Jis member ka gender record nahi, wo sirf Total me ginna jata hai.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {([['daily', 'Daily'], ['week', '7 Days'], ['all', 'All']] as Array<[Period, string]>).map(([key, label]) => (
              <button key={key} onClick={() => setPeriod(key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${period === key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-white'}`}>{label}</button>
            ))}
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-50" aria-label="Refresh team work"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Team work data load nahi hua: {error}<br /><span className="text-xs">Agar ye pehli dafa hai, to di gayi backend fix file (SQL) Supabase me run karein — team analytics RPC usi se active hota hai.</span></span></div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[totals.work, 'Total Work'], [totals.completed, 'Completed'], [totals.failed, 'Failed / Blocked'], [totals.activeMembers, 'Active Members']].map(([n, label]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-2xl font-bold tabular-nums text-slate-950">{loading ? '—' : Number(n).toLocaleString()}</p><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label} · {periodLabel}</p></div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500"><th className="py-2 pr-3 font-bold">Team</th><th className="py-2 px-3 text-right font-bold">Male Team Work</th><th className="py-2 px-3 text-right font-bold">Female Team Work</th><th className="py-2 px-3 text-right font-bold">Total Work</th><th className="py-2 px-3 text-right font-bold">Completed</th><th className="py-2 pl-3 text-right font-bold">Failed</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.team} className="text-slate-700">
                    <td className="py-2.5 pr-3 font-semibold text-slate-950">{r.label}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{loading ? '—' : r.maleWork.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{loading ? '—' : r.femaleWork.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-950">{loading ? '—' : r.totalWork.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{loading ? '—' : r.completed.toLocaleString()}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-rose-700">{loading ? '—' : r.failed.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-slate-950">
                  <td className="py-2.5 pr-3">TOTAL</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{loading ? '—' : totals.male.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{loading ? '—' : totals.female.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{loading ? '—' : totals.work.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{loading ? '—' : totals.completed.toLocaleString()}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{loading ? '—' : totals.failed.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
