import React, { useState, useEffect } from 'react';
import { RefreshCw, Ban, Search, ExternalLink, ShieldAlert } from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { ProfileRecord } from '../../types/profile';

export const CheckingFailedPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const allProfiles = await listProfiles({ status: 'FAILED_BLOCKED', limitCount: 200 });
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

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      !search ||
      p.profileId.toLowerCase().includes(q) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      p.canonicalUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
            Exclusion Archives
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Ban / Failed Records
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles marked FAILED_BLOCKED. Retained permanently for auditability and excluded from normal evidence packaging.
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
            placeholder="Search by Profile ID, Failure notes, or URL..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading records...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No Ban / Failed records found in database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Profile ID</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Canonical URL</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4 text-right">Flagged Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((p) => (
                  <tr key={p.profileId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {p.profileId}
                    </td>
                    <td className="py-3 px-4">{p.platform}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      <a
                        href={p.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-rose-700 hover:underline flex items-center gap-1"
                      >
                        <span className="truncate">{p.canonicalUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                      </a>
                    </td>
                    <td className="py-3 px-4 text-rose-700 font-medium">
                      {p.notes || 'No reason specified'}
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
