import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { listProfiles } from '../../services/profileService';
import { enqueueProfileForChecking } from '../../services/checkingService';
import { useAuth } from '../auth/AuthContext';
import { ProfileRecord, Platform, WorkflowStatus } from '../../types/profile';

export const SearchingProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await listProfiles({ limitCount: 500 });
      setProfiles(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEnqueue = async (profileId: string) => {
    setActionMessage(null);
    try {
      const res = await enqueueProfileForChecking(
        profileId,
        currentUser?.uid || 'SEARCHER',
        currentUser?.email || undefined
      );
      setActionMessage(res.message);
      await loadData();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  };

  const filtered = profiles.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      p.profileId.toLowerCase().includes(query) ||
      (p.srcReferences && p.srcReferences.some((s) => s.toLowerCase().includes(query))) ||
      p.canonicalUrl.toLowerCase().includes(query);

    const matchesPlatform = platformFilter === 'ALL' || p.platform === platformFilter;
    const matchesStatus = statusFilter === 'ALL' || p.currentWorkflowStatus === statusFilter;

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Canonical Directory
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Registered Profiles
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Permanent identities (PRF), platform mappings, associated post counts, and active workflow states.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Database</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-slate-900 text-white text-xs rounded-lg flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Profile ID, SRC reference, or URL..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-slate-800"
          >
            <option value="ALL">All Platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="X">X (Twitter)</option>
            <option value="WEBSITE">Website</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-slate-800"
          >
            <option value="ALL">All Statuses</option>
            <option value="SEARCHED">Searched (Pending Handoff)</option>
            <option value="QUEUED_CHECKING">Queued Checking</option>
            <option value="CHECKING">In Checking</option>
            <option value="VERIFIED">Verified</option>
            <option value="FAILED_BLOCKED">Failed / Blocked</option>
          </select>
        </div>
      </div>

      {/* Profiles Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading profiles...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No profile records match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Profile ID</th>
                  <th className="py-3 px-4">SRC Ref</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Canonical URL</th>
                  <th className="py-3 px-4 text-center">Posts</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((p) => (
                  <tr key={p.profileId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      <div className="flex items-center gap-1.5">
                        <span>{p.profileId}</span>
                        <button
                          onClick={() => handleCopy(p.profileId)}
                          title="Copy Profile ID"
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copiedId === p.profileId ? (
                            <Check className="w-3 h-3 text-blue-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {p.srcReferences && p.srcReferences.length > 0 ? (
                        <span>{p.srcReferences.join(', ')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-800">
                        {p.platform}
                      </span>
                    </td>
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
                    <td className="py-3 px-4 text-center font-mono tabular-nums">
                      {p.postCount || 0}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm ${
                          p.currentWorkflowStatus === 'VERIFIED'
                            ? 'bg-blue-50 text-blue-700'
                            : p.currentWorkflowStatus === 'FAILED_BLOCKED'
                            ? 'bg-rose-50 text-rose-700'
                            : p.currentWorkflowStatus === 'QUEUED_CHECKING'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.currentWorkflowStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.currentWorkflowStatus === 'SEARCHED' ? (
                        <button
                          type="button"
                          onClick={() => handleEnqueue(p.profileId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 rounded transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          <span>Queue for Checking</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Processed</span>
                      )}
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
