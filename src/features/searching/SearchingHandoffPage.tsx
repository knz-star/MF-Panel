import React, { useState, useEffect } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import {
  getCheckingQueueStats,
  enqueueProfileForChecking,
} from '../../services/checkingService';
import { useAuth } from '../auth/AuthContext';
import { ProfileRecord } from '../../types/profile';

export const SearchingHandoffPage: React.FC = () => {
  const [eligibleProfiles, setEligibleProfiles] = useState<ProfileRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [queueStats, setQueueStats] = useState({
    activeQueueCount: 0,
    capacityLimit: 500,
    remainingCapacity: 500,
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handoffResult, setHandoffResult] = useState<{ count: number; error?: string } | null>(
    null
  );
  const { currentUser } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProfiles, stats] = await Promise.all([
        listProfiles({ status: 'SEARCHED', limitCount: 300 }),
        getCheckingQueueStats(),
      ]);
      setEligibleProfiles(allProfiles);
      setQueueStats(stats);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSelect = (profileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        // Enforce not exceeding remaining capacity
        if (next.size >= queueStats.remainingCapacity) {
          alert(
            `Cannot select more profiles than remaining queue capacity (${queueStats.remainingCapacity}).`
          );
          return next;
        }
        next.add(profileId);
      }
      return next;
    });
  };

  const handleSelectAllAvailable = () => {
    const maxToSelect = Math.min(eligibleProfiles.length, queueStats.remainingCapacity);
    const newSelected = new Set(eligibleProfiles.slice(0, maxToSelect).map((p) => p.profileId));
    setSelectedIds(newSelected);
  };

  const handleExecuteHandoff = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    setHandoffResult(null);

    let successCount = 0;
    try {
      for (const id of Array.from(selectedIds)) {
        await enqueueProfileForChecking(
          id,
          currentUser?.uid || 'SEARCHER',
          currentUser?.email || undefined
        );
        successCount++;
      }
      setHandoffResult({ count: successCount });
      await loadData();
    } catch (err: any) {
      setHandoffResult({ count: successCount, error: err.message });
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const usagePercent = Math.min(
    100,
    Math.round((queueStats.activeQueueCount / queueStats.capacityLimit) * 100)
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Queue Capacity & Handoff
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Checking Handoff Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Transition eligible SEARCHED profiles into the Checking Team active queue while honoring the 500-slot limit.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {handoffResult && (
        <div
          className={`p-4 rounded-xl text-xs border ${
            handoffResult.error
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Successfully enqueued {handoffResult.count} profile(s) for Checking.</span>
          </div>
          {handoffResult.error && (
            <div className="mt-1 text-rose-700">Warning: {handoffResult.error}</div>
          )}
        </div>
      )}

      {/* Queue Capacity Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Checking Queue Capacity Monitor
            </h2>
          </div>
          <div className="text-xs font-mono font-semibold text-slate-700">
            {queueStats.activeQueueCount} / {queueStats.capacityLimit} Slots Assigned
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              usagePercent > 90
                ? 'bg-rose-500'
                : usagePercent > 70
                ? 'bg-amber-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          ></div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Active queue load: {usagePercent}%</span>
          <span className="font-semibold text-slate-900">
            {queueStats.remainingCapacity} available slots
          </span>
        </div>
      </div>

      {/* Eligible Profiles Selection */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Eligible Profiles ({eligibleProfiles.length} Available)
            </h2>
            <p className="text-[11px] text-slate-500">
              Profiles with SEARCHED status that haven't been claimed or assigned yet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllAvailable}
              disabled={eligibleProfiles.length === 0 || queueStats.remainingCapacity === 0}
              className="px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Select Max ({Math.min(eligibleProfiles.length, queueStats.remainingCapacity)})
            </button>
            <button
              type="button"
              onClick={handleExecuteHandoff}
              disabled={isSubmitting || selectedIds.size === 0}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enqueuing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Enqueue {selectedIds.size} Selected</span>
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading eligible profiles...</div>
        ) : eligibleProfiles.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No profiles awaiting handoff. All registered records are currently in queue or checked.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Select</th>
                  <th className="py-2.5 px-3">Profile ID</th>
                  <th className="py-2.5 px-3">SRC Reference</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Canonical URL</th>
                  <th className="py-2.5 px-3 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {eligibleProfiles.map((p) => (
                  <tr key={p.profileId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.profileId)}
                        onChange={() => handleToggleSelect(p.profileId)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-950">
                      {p.profileId}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {p.srcReferences?.[0] || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-slate-900">
                        {p.platform}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      {p.canonicalUrl}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
