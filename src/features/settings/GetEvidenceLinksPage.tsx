import React, { useEffect, useState } from 'react';
import { Download, FileJson, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getEvidenceDashboardSummary, getEvidenceLinksPage, recordEvidenceLinksDownload, type EvidenceDashboardSummary, type EvidenceLinkRecord } from '../../services/evidenceLinkingService';
import { ErrorDiagnosticPanel } from '../../components/ErrorDiagnosticPanel';

export const GetEvidenceLinksPage: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [diagnosticError, setDiagnosticError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<EvidenceDashboardSummary | null>(null);
  useEffect(() => { void getEvidenceDashboardSummary().then((value) => { setSummary(value); setError(''); setDiagnosticError(null); }).catch((e) => { setSummary(null); setDiagnosticError(e); setError('Evidence backend status could not be loaded.'); }); }, []);
  const download = async () => {
    setBusy(true); setError(''); setDiagnosticError(null); setDone(false); setProgress('Checking application authorization…');
    try {
      const links: EvidenceLinkRecord[] = [];
      let cursor: string | null = null;
      let total = 0;
      do {
        const page = await getEvidenceLinksPage(cursor);
        total = page.total;
        links.push(...page.links);
        cursor = page.nextCursor;
        setProgress(`Preparing ${links.length.toLocaleString()} of ${total.toLocaleString()} records…`);
      } while (cursor);
      const platformCounts: Record<string, number> = {};
      for (const link of links) platformCounts[link.platform] = (platformCounts[link.platform] || 0) + 1;
      const payload = { application: 'MF Evidence', exportedAt: new Date().toISOString(), total: links.length, platforms: platformCounts, links };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `mf-evidence-links-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      await recordEvidenceLinksDownload(links.length, platformCounts);
      setProgress(`${links.length.toLocaleString()} records exported and download event recorded.`); setDone(true);
    } catch (e) {
      setDiagnosticError(e);
      const code = typeof e === 'object' && e && 'code' in e ? String(e.code) : '';
      setError(code.includes('permission-denied') ? 'Your Evidence app connection is not active. Link the application again or contact an administrator.' : 'Download could not be completed. Check your connection and try again.');
      setProgress('');
    } finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-3xl space-y-5"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><FileJson className="h-6 w-6"/></div><div><h2 className="text-xl font-bold text-slate-950">Get Links</h2><p className="mt-1 text-sm leading-6 text-slate-500">Export the existing VERIFIED profile links as JSON. Failed/blocked and unchecked profiles are excluded. Every page request checks your active Evidence registration on the backend.</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-slate-100 bg-slate-50 p-3 col-span-2 sm:col-span-4"><p className="text-xs text-slate-500">Available verified links</p><p className="mt-1 text-2xl font-bold text-slate-950">{summary?.active ? (summary.totalProfiles ?? '—').toLocaleString() : '—'}</p><p className="mt-1 text-[11px] text-slate-500">{summary?.active ? `Authorized team: ${summary.teamId || 'Confirmed'}` : 'An active linked application is required'}</p></div>{Object.entries(summary?.platformCounts || {}).map(([platform,count]) => <div key={platform} className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{platform}</p><p className="mt-1 text-lg font-bold text-slate-900">{count.toLocaleString()}</p></div>)}</div><div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"/><p className="text-xs leading-5 text-slate-600">Access is rechecked during export. If the application is disconnected or revoked, further pages are blocked. The completed export is logged in the central audit events.</p></div></div>{error && <div className="mt-4 space-y-2"><p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p><ErrorDiagnosticPanel error={diagnosticError ?? error} /></div>}{progress && <p role="status" className={`mt-4 rounded-xl p-3 text-sm ${done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700'}`}>{progress}</p>}<button onClick={() => void download()} disabled={busy || summary?.active !== true} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}{busy ? 'Preparing JSON…' : 'Download JSON'}</button></section></div>;
};
