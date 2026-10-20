import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Link2, RefreshCw, Smartphone } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getEvidenceDashboardSummary, watchEvidenceRegistration, type EvidenceDashboardSummary } from '../../services/evidenceLinkingService';

export const EvidenceAppStatusCard: React.FC = () => {
  const { currentUser } = useAuth();
  const [summary, setSummary] = useState<EvidenceDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try { setSummary(await getEvidenceDashboardSummary()); }
    catch { setSummary(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (!currentUser?.uid) return; return watchEvidenceRegistration(currentUser.uid, () => { void refresh(); }, () => { setSummary(null); setLoading(false); }); }, [currentUser?.uid]);
  const active = summary?.active === true;
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}><Smartphone className="h-5 w-5"/></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-slate-950">Evidence App: MF Evidence</h2><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{loading ? 'Checking status' : active ? 'Linked & Activated' : 'Not Linked'}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{active ? `Team authorized: ${summary?.teamId || 'Confirmed'} · Available verified links: ${summary?.totalProfiles ?? '—'}` : 'Link your Android application to unlock authorized Evidence access.'}</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Evidence status" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button><Link to={active ? '/dashboard/evidence-linking' : '/dashboard/evidence-linking'} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">{active ? <CheckCircle2 className="h-4 w-4"/> : <Link2 className="h-4 w-4"/>}{active ? 'Manage Connection' : 'Link Evidence App'}</Link>{active && <Link to="/dashboard/get-links" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Get Links</Link>}<Link to="/dashboard/evidence-performance" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Performance</Link></div></div></section>;
};
