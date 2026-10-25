import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Layers,
  Clock,
  CheckCircle2,
  Ban,
  FileArchive,
  RefreshCw,
  Search,
  Settings,
  AlertTriangle,
  History,
  Activity,
  RotateCcw,
  ArrowRight,
  Link2,
  BarChart3,
  ClipboardCheck,
  Plug,
  Workflow,
  HeartPulse,
} from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { listAllPosts } from '../../services/postService';
import { listCheckingRecords } from '../../services/checkingService';
import { listReportJobs } from '../../services/reportService';
import { listAllUsers } from '../../services/userService';
import { listAuditLogs } from '../../services/workflowService';
import { UserProfile } from '../../types/user';
import { AdminTeamWorkPanel } from './AdminTeamWorkPanel';
import { ProfileRecord } from '../../types/profile';
import { getDashboardMetrics, type DashboardMetrics } from '../../services/dashboardMetricsService';

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProfiles: 0,
    totalPosts: 0,
    pendingChecking: 0,
    verifiedRecords: 0,
    failedBlocked: 0,
    totalUsers: 0,
    totalJobs: 0,
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);

  // Global search state
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ProfileRecord[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProfiles, allPosts, usersList, jobsList, dashboardMetrics] = await Promise.all([
        listProfiles({ limitCount: 500 }),
        listAllPosts(500),
        listAllUsers(100),
        listReportJobs(100),
        getDashboardMetrics(7),
      ]);
      setMetrics(dashboardMetrics);

      const pending = allProfiles.filter((p) => p.currentWorkflowStatus === 'QUEUED_CHECKING').length;
      const verified = allProfiles.filter((p) => p.currentWorkflowStatus === 'VERIFIED').length;
      const failed = allProfiles.filter((p) => p.currentWorkflowStatus === 'FAILED_BLOCKED').length;

      setStats({
        totalProfiles: dashboardMetrics.totals.profiles,
        totalPosts: dashboardMetrics.totals.posts,
        pendingChecking: pending,
        verifiedRecords: verified,
        failedBlocked: failed,
        totalUsers: dashboardMetrics.totals.activeUsers,
        totalJobs: jobsList.length,
      });

      setUsers(usersList);
      setProfiles(allProfiles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalQuery.trim()) {
      setSearchResult([]);
      return;
    }
    const q = globalQuery.toLowerCase().trim();
    const matches = profiles.filter((p) => {
      return (
        p.profileId.toLowerCase().includes(q) ||
        p.canonicalUrl.toLowerCase().includes(q) ||
        (p.srcReferences && p.srcReferences.some((s) => s.toLowerCase().includes(q))) ||
        p.platform.toLowerCase().includes(q)
      );
    });
    setSearchResult(matches);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
            Restricted Console
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Admin Master Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quick overview and shortcuts to dedicated admin pages. Detailed tools stay on their own pages to keep this home screen focused.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin/tests" className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800 shadow-sm transition hover:bg-blue-100"><Activity className="h-3.5 w-3.5" /> Run System Tests</Link>
        <Link to="/admin/workflow-control" className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800 shadow-sm transition hover:bg-rose-100"><RotateCcw className="h-3.5 w-3.5" /> System Test Reset</Link>
        <Link to="/admin/assets" className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800">
          <Settings className="h-3.5 w-3.5" /> Manage Landing Assets
        </Link>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh All Metrics</span>
        </button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Profiles</span>
          <span className="text-xl font-bold font-mono text-slate-950 tabular-nums">
            {loading ? '—' : stats.totalProfiles}
          </span>
        </div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Posts</span>
          <span className="text-xl font-bold font-mono text-slate-950 tabular-nums">
            {loading ? '—' : stats.totalPosts}
          </span>
        </div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">In Queue</span>
          <span className="text-xl font-bold font-mono text-amber-600 tabular-nums">
            {loading ? '—' : stats.pendingChecking}
          </span>
        </div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Verified</span>
          <span className="text-xl font-bold font-mono text-blue-700 tabular-nums">
            {loading ? '—' : stats.verifiedRecords}
          </span>
        </div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Blocked</span>
          <span className="text-xl font-bold font-mono text-rose-600 tabular-nums">
            {loading ? '—' : stats.failedBlocked}
          </span>
        </div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Users</span>
          <span className="text-xl font-bold font-mono text-slate-950 tabular-nums">
            {loading ? '—' : stats.totalUsers}
          </span>
        </div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Jobs</span>
          <span className="text-xl font-bold font-mono text-blue-700 tabular-nums">
            {loading ? '—' : stats.totalJobs}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 -mt-5">
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm"><span className="text-[10px] text-slate-400 block uppercase font-medium">Links collected today</span><span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">{loading ? '—' : (metrics?.daily.find(d => d.date === new Date().toISOString().slice(0,10))?.searchingTotal ?? 0).toLocaleString()}</span></div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm"><span className="text-[10px] text-slate-400 block uppercase font-medium">Links collected · 7 days</span><span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">{loading ? '—' : (metrics?.daily.reduce((n,d) => n+d.searchingTotal,0) ?? 0).toLocaleString()}</span></div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm"><span className="text-[10px] text-slate-400 block uppercase font-medium">Links checked · all time</span><span className="text-xl font-bold font-mono text-blue-700 tabular-nums">{loading ? '—' : (metrics?.totals.checkingChecked ?? 0).toLocaleString()}</span></div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm"><span className="text-[10px] text-slate-400 block uppercase font-medium">Evidence links assigned</span><span className="text-xl font-bold font-mono text-indigo-700 tabular-nums">{loading ? '—' : (metrics?.totals.evidenceAssigned ?? 0).toLocaleString()}</span></div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm"><span className="text-[10px] text-slate-400 block uppercase font-medium">Evidence ZIP links analyzed</span><span className="text-xl font-bold font-mono text-purple-700 tabular-nums">{loading ? '—' : (metrics?.totals.evidenceCompleted ?? 0).toLocaleString()}</span></div>
        <div className="p-4 bg-white/90 rounded-[22px] border border-white shadow-sm"><span className="text-[10px] text-slate-400 block uppercase font-medium">Reports</span><span className="text-sm font-bold text-slate-700">Counted with Evidence ZIP analysis</span></div>
      </div>

      {/* Team Work by gender group + period */}
      <AdminTeamWorkPanel />

      {/* Global Record Search */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Global Record Search
          </h2>
          <p className="text-[11px] text-slate-500">
            Quick search across loaded profiles. For full URL / public ID lookup and the recorded workflow roadmap, use Global Tracker.
          </p></div><Link to="/admin/global-tracker" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700"><Search className="h-3.5 w-3.5"/>Open Global Tracker</Link>
        </div>

        <form onSubmit={handleGlobalSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Enter Profile ID, SRC reference, or URL..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Search Records
          </button>
        </form>

        {searchResult.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Profile ID</th>
                  <th className="py-2.5 px-3">SRC Reference</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Canonical URL</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {searchResult.map((p) => (
                  <tr key={p.profileId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-950">{p.profileId}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{p.srcReferences?.[0] || '—'}</td>
                    <td className="py-2.5 px-3">{p.platform}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">{p.canonicalUrl}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {p.currentWorkflowStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Modules Quick Jump */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/admin/users"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">User & Role Management</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Configure user access roles (ADMIN, USER, CHECKER, SEARCHER) and toggle authorized module permissions.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Manage Users</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/duplicates"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Duplicate Review Console</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Inspect multi-intake records and examine historical identity mapping without creating orphaned profiles.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Review Duplicates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>


        <Link
          to="/admin/links"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <Link2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Link Management</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Search, filter, export and batch-manage every tracked profile and post link.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Manage Links</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/analytics"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Team Analytics</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Per-team scores, member performance, daily trends and low-score warnings.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Open Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/gender-teams"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-pink-50 text-pink-700 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Male & Female Teams</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Gender-group dashboards, group leads, member work and WhatsApp Support numbers.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Open Gender Teams</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/checking-results"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Checking Results</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Review verified, invalid and blocked outcomes recorded by the Checking team.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>View Results</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/evidence-connections"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center mb-3">
              <Plug className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Evidence Connections</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Android app linking status and evidence-team device connections.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Open Connections</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/evidence-operations"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-3">
              <Workflow className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">Evidence Operations</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Evidence assignment operations, queues and processing controls.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Open Operations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/admin/system-health"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center mb-3">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">System Health</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Backend connectivity, service status and platform health checks.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Check Health</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          to="/settings"
          className="p-5 bg-white/90 rounded-[24px] border border-white hover:border-blue-100 hover:shadow-lg transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center mb-3">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">System & Queue Settings</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Adjust active checking queue capacity limit (default 500) and configure retention intervals.
            </p>
          </div>
          <div className="mt-4 text-xs font-semibold text-blue-700 flex items-center gap-1">
            <span>Configure System</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>
    </div>
  );
};
