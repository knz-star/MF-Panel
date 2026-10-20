import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { getCheckingQueue, getCheckingQueueStats } from '../../services/checkingService';
import { CheckingQueueItem } from '../../types/checking';

export const CheckingQueuePage: React.FC = () => {
  const [queueItems, setQueueItems] = useState<CheckingQueueItem[]>([]);
  const [stats, setStats] = useState({
    activeQueueCount: 0,
    capacityLimit: 500,
    remainingCapacity: 500,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [items, s] = await Promise.all([
        getCheckingQueue(200),
        getCheckingQueueStats(),
      ]);
      setQueueItems(items);
      setStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = queueItems.filter((i) => {
    const q = search.toLowerCase();
    return (
      !search ||
      i.profileId.toLowerCase().includes(q) ||
      i.srcReference.toLowerCase().includes(q) ||
      i.profileUrl.toLowerCase().includes(q) ||
      i.platform.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Verification Queue
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Active Checking Queue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles assigned by Searching Team awaiting verification decisions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 font-mono block">CAPACITY LOAD</span>
            <span className="text-xs font-bold text-slate-800 font-mono">
              {stats.activeQueueCount} / {stats.capacityLimit}
            </span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queue by Profile ID, SRC, Platform, or URL..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading queue records...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No active queue items found. Enqueue profiles from the Searching Team module.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Profile ID</th>
                  <th className="py-3 px-4">SRC Ref</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Profile Canonical URL</th>
                  <th className="py-3 px-4">Queue Assignment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((item) => (
                  <tr key={item.profileId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {item.profileId}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {item.srcReference}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-900">
                        {item.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      <a
                        href={item.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-blue-700 hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{item.profileUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                      </a>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(item.queueAssignmentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/checking/record/${item.profileId}`}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span>Check Record</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
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
