import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  CheckCircle2,
  Ban,
  FileArchive,
  ArrowRight,
  Search,
  Activity,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listProfiles } from '../../services/profileService';
import { listRecentWorkflowActivity } from '../../services/workflowService';
import { listReportJobs } from '../../services/reportService';
import { WorkflowEvent } from '../../types/workflow';
import { ProfileRecord } from '../../types/profile';

export const UserDashboard: React.FC = () => {
  const { userProfile, hasModuleAccess, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProfiles: 0,
    pendingChecking: 0,
    verifiedRecords: 0,
    failedBlocked: 0,
    reportJobsCount: 0,
  });
  const [recentActivities, setRecentActivities] = useState<WorkflowEvent[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<ProfileRecord[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profiles, activities, jobs] = await Promise.all([
        listProfiles({ limitCount: 300 }),
        listRecentWorkflowActivity(20),
        listReportJobs(20),
      ]);

      const pending = profiles.filter((p) => p.currentWorkflowStatus === 'QUEUED_CHECKING').length;
      const verified = profiles.filter((p) => p.currentWorkflowStatus === 'VERIFIED').length;
      const failed = profiles.filter((p) => p.currentWorkflowStatus === 'FAILED_BLOCKED').length;

      setStats({
        totalProfiles: profiles.length,
        pendingChecking: pending,
        verifiedRecords: verified,
        failedBlocked: failed,
        reportJobsCount: jobs.length,
      });

      setRecentProfiles(profiles.slice(0, 5));
      setRecentActivities(activities);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Banner & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Workflow Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <span className="font-semibold text-slate-800">{userProfile?.displayName || 'User'}</span> · Role: <span className="font-mono text-blue-700">{userProfile?.role}</span>
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Registered Profiles</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-950 font-mono tabular-nums">
            {loading ? '—' : stats.totalProfiles}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Central database records</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Pending Checking</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-950 font-mono tabular-nums">
            {loading ? '—' : stats.pendingChecking}
          </div>
          <span className="text-[10px] text-amber-600 font-medium mt-1 block">Active queue assignments</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Verified Records</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-950 font-mono tabular-nums">
            {loading ? '—' : stats.verifiedRecords}
          </div>
          <span className="text-[10px] text-blue-600 font-medium mt-1 block">Approved & mapped</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Failed / Blocked</span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-950 font-mono tabular-nums">
            {loading ? '—' : stats.failedBlocked}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Retained for review</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Report Jobs</span>
            <FileArchive className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-950 font-mono tabular-nums">
            {loading ? '—' : stats.reportJobsCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">ZIP packaging sessions</span>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider text-[11px]">
          Quick Workflow Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/searching/import"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-2xs transition-all flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Import WhatsApp Text
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Extract & normalize links into canonical profiles
              </div>
            </div>
          </Link>

          <Link
            to="/checking/queue"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-2xs transition-all flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Open Checking Queue
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Verify active profiles & assign post URLs
              </div>
            </div>
          </Link>

          <Link
            to="/activity"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-2xs transition-all flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                View Workflow Logs
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Inspect immutable state transitions and history
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Two-column overview: Recently Registered Profiles & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Profiles */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recently Registered Profiles
            </h3>
            <Link
              to="/searching/profiles"
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading profiles...</div>
          ) : recentProfiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No profiles registered yet. Start by importing links in Searching Team.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentProfiles.map((p) => (
                <div key={p.profileId} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">{p.profileId}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {p.srcReferences?.[0] || ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                      {p.canonicalUrl}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wide ${
                        p.currentWorkflowStatus === 'VERIFIED'
                          ? 'bg-blue-50 text-blue-700'
                          : p.currentWorkflowStatus === 'FAILED_BLOCKED'
                          ? 'bg-rose-50 text-rose-700'
                          : p.currentWorkflowStatus === 'QUEUED_CHECKING'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.currentWorkflowStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Log */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Workflow Audit Log
            </h3>
            <Link
              to="/activity"
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Full History</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading audit trail...</div>
          ) : recentActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No workflow events recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.slice(0, 5).map((evt) => (
                <div key={evt.eventId} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {evt.action.replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-slate-700">{evt.profileId}</span>
                      <span>·</span>
                      <span>{evt.actorEmail || 'System'}</span>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-mono tabular-nums">
                    {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
