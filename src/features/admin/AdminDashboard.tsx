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
  ArrowRight,
} from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { listAllPosts } from '../../services/postService';
import { listCheckingRecords } from '../../services/checkingService';
import { listReportJobs } from '../../services/reportService';
import { listAllUsers } from '../../services/userService';
import { listAuditLogs } from '../../services/workflowService';
import { UserProfile } from '../../types/user';
import { ProfileRecord } from '../../types/profile';

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
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);

  // Global search state
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchResult, setSearchResult] = useState<ProfileRecord[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProfiles, allPosts, usersList, jobsList] = await Promise.all([
        listProfiles({ limitCount: 500 }),
        listAllPosts(500),
        listAllUsers(100),
        listReportJobs(100),
      ]);

      const pending = allProfiles.filter((p) => p.currentWorkflowStatus === 'QUEUED_CHECKING').length;
      const verified = allProfiles.filter((p) => p.currentWorkflowStatus === 'VERIFIED').length;
      const failed = allProfiles.filter((p) => p.currentWorkflowStatus === 'FAILED_BLOCKED').length;

      setStats({
        totalProfiles: allProfiles.length,
        totalPosts: allPosts.length,
        pendingChecking: pending,
        verifiedRecords: verified,
        failedBlocked: failed,
        totalUsers: usersList.length,
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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
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

      {/* Global Record Search */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Global Record Search
          </h2>
          <p className="text-[11px] text-slate-500">
            Query across all canonical profiles by Profile ID (PRF), SRC reference, Platform, or full URL.
          </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
