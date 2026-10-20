import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { RefreshCw, AlertTriangle, CheckCircle2, Search, ExternalLink } from 'lucide-react';
import { listProfiles, deleteProfile } from '../../services/profileService';
import { ProfileRecord } from '../../types/profile';
import { updateDoc, doc } from '../../lib/supabaseDocumentStore';
import { db } from '../../lib/backend';

export const SearchingDuplicatesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewReason, setReviewReason] = useState('');
  const { isAdmin } = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await listProfiles({ limitCount: 300 });
      // Identify profiles with multiple intake SRC references (indicating repeated imports)
      const duplicateProfiles = all.filter((p) => p.srcReferences && p.srcReferences.length > 1);
      setProfiles(duplicateProfiles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const removeSelected = async () => {
    if (!isAdmin || selected.length === 0) return;
    if (!window.confirm(`Permanently remove ${selected.length} selected profile(s)? This cannot be undone.`)) return;
    try {
      for (const id of selected) await deleteProfile(id);
      setSelected([]);
      await loadData();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not remove selected links. Check Supabase database permissions.'); }
  };

  const saveReviewReason = async (profile: ProfileRecord) => {
    if (!isAdmin || !reviewReason.trim()) return;
    try {
      await updateDoc(doc(db, 'profiles', profile.profileId), { duplicateReviewReason: reviewReason.trim(), duplicateReviewedAt: new Date().toISOString() });
      setProfiles((items) => items.map((item) => item.profileId === profile.profileId ? { ...item, notes: `${item.notes || ''}\nDuplicate review: ${reviewReason.trim()}`.trim() } : item));
      setReviewReason('');
      window.alert('Duplicate review reason saved.');
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not save review reason.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Identity Protection
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Duplicate Review Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles with multiple intake occurrences. Permanent canonical identities (PRF) are preserved without creating orphaned records.
          </p>
        </div>
        {isAdmin && <button onClick={removeSelected} disabled={!selected.length} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Remove selected ({selected.length})</button>}
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading duplicate logs...</div>
        ) : profiles.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No duplicate intake occurrences detected. All current database records have clean 1-to-1 canonical mappings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  {isAdmin && <th className="py-3 px-4">Select</th>}
                  <th className="py-3 px-4">Canonical Profile ID</th>
                  <th className="py-3 px-4">All Associated SRC References</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Canonical URL</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Intake Occurrences</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {profiles.map((p) => (
                  <tr key={p.profileId} className="hover:bg-slate-50/70 transition-colors">
                    {isAdmin && <td className="py-3 px-4"><input aria-label={`Select ${p.profileId}`} type="checkbox" checked={selected.includes(p.profileId)} onChange={(e) => setSelected((items) => e.target.checked ? [...items, p.profileId] : items.filter((id) => id !== p.profileId))} /></td>}
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {p.profileId}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                      <div className="flex flex-wrap gap-1">
                        {p.srcReferences.map((s) => (
                          <span key={s} className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-800">
                        {p.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      {p.canonicalUrl}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {p.currentWorkflowStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 tabular-nums">
                      {p.srcReferences.length} Times Imported
                      {isAdmin && <div className="mt-2 flex min-w-48 flex-col gap-1"><input value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Duplicate reason" className="rounded-lg border border-slate-200 px-2 py-1 text-left font-sans font-normal" /><button onClick={() => void saveReviewReason(p)} className="rounded-lg bg-slate-900 px-2 py-1 text-white font-sans font-semibold">Save review</button><button onClick={() => { setSelected([p.profileId]); }} className="rounded-lg border border-rose-200 px-2 py-1 text-rose-700 font-sans">Select to remove</button></div>}
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
