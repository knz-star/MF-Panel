import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Search, ExternalLink, Link2 } from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { listCheckingRecords } from '../../services/checkingService';
import { ProfileRecord } from '../../types/profile';
import { CheckingRecord } from '../../types/checking';

export const CheckingVerifiedPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [checkingRecords, setCheckingRecords] = useState<CheckingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProfiles, records] = await Promise.all([
        listProfiles({ status: 'VERIFIED', limitCount: 200 }),
        listCheckingRecords('VERIFIED', 200),
      ]);
      setProfiles(allProfiles);
      setCheckingRecords(records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      !search ||
      p.profileId.toLowerCase().includes(q) ||
      (p.region && p.region.toLowerCase().includes(q)) ||
      p.canonicalUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Verified Archives
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Verified Records Registry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles validated by the Checking Team with assigned regions and attached post records.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Profile ID, Region, or URL..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading verified records...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No verified profiles found. Records will appear here after being marked Verified in the queue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Profile ID</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Canonical URL</th>
                  <th className="py-3 px-4 text-center">Post Links</th>
                  <th className="py-3 px-4 text-right">Verified Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((p) => (
                  <tr key={p.profileId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {p.profileId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {p.region || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4">{p.platform}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      <a
                        href={p.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-blue-700 hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{p.canonicalUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                      </a>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-blue-700 tabular-nums">
                      {p.postCount || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(p.updatedAt).toLocaleDateString()}
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
