import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';
import { getDashboardMetrics, type DashboardMetrics, type DashboardDailyMetric } from '../../services/dashboardMetricsService';
import { SearchingContributorTable } from './SearchingContributorTable';

type Period = 'daily' | 'week' | 'all';
const TEAMS = [
  { key: 'searching', label: 'Searching Team', metric: 'Links collected', color: '#C8853F' },
  { key: 'checking', label: 'Checking Team', metric: 'Links checked', color: '#4777B8' },
  { key: 'evidence', label: 'Evidence Team', metric: 'Links assigned', color: '#56866B' },
  { key: 'reports', label: 'Report Team', metric: 'Included with Evidence ZIP analysis', color: '#8A8176' },
] as const;
const n = (value: number) => value.toLocaleString();
const today = () => new Date().toISOString().slice(0, 10);

export const AdminTeamWorkPanel: React.FC = () => {
  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const metrics = await getDashboardMetrics(7); setData(metrics); }
    catch (e) { setError(e instanceof Error ? e.message : 'Team metrics could not load.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 30000); return () => window.clearInterval(id); }, [load]);

  const selectedDays = useMemo(() => {
    const rows = data?.daily ?? [];
    if (period === 'daily') return rows.filter(d => d.date === today());
    return rows;
  }, [data, period]);
  const metricFor = (team: typeof TEAMS[number], row: DashboardDailyMetric) => {
    if (team.key === 'searching') return row.searchingTotal;
    if (team.key === 'checking') return row.checkingChecked;
    if (team.key === 'evidence') return row.evidenceAssigned;
    return 0;
  };
  const totalFor = (team: typeof TEAMS[number]) => {
    if (!data) return 0;
    if (period === 'all') {
      if (team.key === 'searching') return data.totals.totalLinks;
      if (team.key === 'checking') return data.totals.checkingChecked;
      if (team.key === 'evidence') return data.totals.evidenceAssigned;
      return 0;
    }
    return selectedDays.reduce((sum, day) => sum + metricFor(team, day), 0);
  };
  const maxDaily = Math.max(1, ...(data?.daily.flatMap(d => [d.searchingTotal,d.checkingChecked,d.evidenceAssigned,d.evidenceCompleted]) ?? [1]));

  return <section className="rounded-2xl border border-[#E2D9C8] bg-[#FBF7EF] p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#1F2421]"><BarChart3 className="h-4 w-4 text-[#C8853F]"/>Team Operations · Live Counts</h2><p className="mt-1 text-xs leading-5 text-[#716D64]">Actual database records only. Searching counts intake, Checking counts completed checks, and Evidence counts assigned links. Report work is counted through Evidence ZIP analysis—not as a separate completed team.</p></div>
      <div className="flex items-center gap-2"><div className="flex rounded-xl border border-[#E2D9C8] bg-white p-1">{([['daily','Today'],['week','7 Days'],['all','All Time']] as Array<[Period,string]>).map(([key,label])=><button key={key} onClick={()=>setPeriod(key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${period===key?'bg-[#2A2723] text-white':'text-[#716D64] hover:bg-[#F6F1E8]'}`}>{label}</button>)}</div><button onClick={()=>void load()} disabled={loading} aria-label="Refresh live team metrics" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2D9C8] bg-white text-[#716D64] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div>
    </div>
    {error ? <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{TEAMS.map(team=><article key={team.key} className="rounded-2xl border border-[#E2D9C8] bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-[#716D64]">{team.label}</p><span className="h-2.5 w-2.5 rounded-full" style={{background:team.color}}/></div><p className="mt-2 text-2xl font-extrabold tabular-nums text-[#1F2421]">{loading?'—':team.key==='reports'?'—':n(totalFor(team))}</p><p className="mt-1 text-[11px] text-[#716D64]">{team.metric}</p>{team.key==='searching'&&<p className="mt-2 text-[10px] text-[#8A8176]">All-time total: {loading?'—':n(data?.totals.totalLinks??0)}</p>}{team.key==='checking'&&<p className="mt-2 text-[10px] text-[#8A8176]">Verified {loading?'—':n(data?.totals.checkingVerified??0)} · Failed/blocked {loading?'—':n(data?.totals.checkingFailed??0)}</p>}{team.key==='evidence'&&<p className="mt-2 text-[10px] text-[#8A8176]">ZIP-analyzed: {loading?'—':n(data?.totals.evidenceCompleted??0)}</p>}</article>)}</div>
      <div className="mt-5 rounded-2xl border border-[#E2D9C8] bg-white p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#1F2421]">7-day workflow activity</h3><p className="mt-1 text-xs text-[#716D64]">Daily intake, completed checks and Evidence assignments</p></div><span className="inline-flex items-center gap-1 text-[10px] text-[#8A8176]"><Activity className="h-3.5 w-3.5"/>Refreshes every 30s</span></div><div className="mt-4 grid grid-cols-7 gap-2">{(data?.daily??[]).map(day=><div key={day.date} className="min-w-0"><div className="flex h-32 items-end justify-center gap-1 rounded-lg bg-[#F6F1E8] px-1 pb-1 pt-2">{[day.searchingTotal,day.checkingChecked,day.evidenceAssigned,day.evidenceCompleted].map((value,i)=><div key={i} title={`${['Searching links','Checked links','Evidence assignments','Evidence ZIP analyzed'][i]}: ${value}`} className="w-1/4 rounded-t-sm" style={{height:`${Math.max(value?4:0,value/maxDaily*100)}%`,background:['#C8853F','#4777B8','#56866B','#8B6DB0'][i],opacity:value?1:.15}}/>)}</div><p className="mt-1 truncate text-center text-[9px] text-[#8A8176]">{day.date.slice(5)}</p></div>)}</div><div className="mt-3 flex flex-wrap gap-4">{[{label:'Searching links',color:'#C8853F'},{label:'Checked links',color:'#4777B8'},{label:'Evidence assignments',color:'#56866B'},{label:'Evidence ZIP analyzed',color:'#8B6DB0'}].map(item=><span key={item.label} className="inline-flex items-center gap-2 text-xs font-semibold text-[#716D64]"><span className="h-2.5 w-2.5 rounded-sm" style={{background:item.color}}/>{item.label}</span>)}</div></div>
    </>}
    <SearchingContributorTable enabled={true} />
  </section>;
};
