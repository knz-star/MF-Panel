import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, doc, getDoc, setDoc } from '../../lib/supabaseDocumentStore';
import JSZip from 'jszip';
import {
  UploadCloud,
  FileArchive,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  Download,
  Settings2,
  RefreshCw,
  Eye,
  FileText,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  analyzeUploadedZip,
  buildAndDownloadReportPackage,
  AnalysisSessionResult,
} from '../../services/reportService';
import { matchUploadedZip } from '../../services/linkWorkflowService';
import { supabase } from '../../lib/supabase';
import { ExtractedUrlItem, ExtractedScreenshotItem, ReportPackageManifest, EvidenceBatchManifest } from '../../types/report';

export const NewReportAnalysisPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedManifestFile, setSelectedManifestFile] = useState<File | null>(null);
  const [batchManifest, setBatchManifest] = useState<EvidenceBatchManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [archivePassword, setArchivePassword] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [savedSnapshot, setSavedSnapshot] = useState<any>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const requestedJobId = searchParams.get('jobId');
  useEffect(() => {
    if (!requestedJobId) { setSavedSnapshot(null); return; }
    let alive = true; setSnapshotLoading(true);
    void getDoc(doc(db, 'reportAnalysisSnapshots', requestedJobId)).then(snap => { if (alive) setSavedSnapshot(snap.exists() ? snap.data() : null); }).catch(() => { if (alive) setSavedSnapshot(null); }).finally(() => { if (alive) setSnapshotLoading(false); });
    return () => { alive = false; };
  }, [requestedJobId]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSessionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linksPerFolder, setLinksPerFolder] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<'LINKS' | 'SCREENSHOTS' | 'PACKAGING'>('LINKS');
  const [assignmentMatch, setAssignmentMatch] = useState<{matchedCount:number;unmatchedCount:number;jobId:string;matched:Array<{profileId:string;mfpProfileId?:string|null;profileHandle?:string|null;assignedTo:string;url:string;platform:string;assignmentId:string}>}|null>(null);

  // Package download state
  const [downloadPackage, setDownloadPackage] = useState<{
    packageZipBlob: Blob;
    physicalPackageZipBlob: Blob;
    onlinePackageZipBlob: Blob;
    linkTxtBlob: Blob;
    screenshotsZipBlob: Blob;
    screenshotsPdfBlob: Blob;
    screenshotsPdfPartCount: number;
    linksZipBlob: Blob;
    manifest: ReportPackageManifest;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0] ?? null;
    // Reset the native picker input after capturing the File. This supports
    // re-selecting the same ZIP and avoids stale picker state on mobile browsers.
    input.value = '';
    if (!file) return; // User cancelled the picker; preserve the current screen.
    if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      setSelectedFile(null); setErrorMessage('Please select a ZIP archive (.zip).');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setSelectedFile(null); setErrorMessage('ZIP file is larger than the 100 MB limit.');
      return;
    }
    setSelectedFile(file);
    setAnalysisResult(null);
    setDownloadPackage(null);
    setAssignmentMatch(null);
    setErrorMessage(null);
  };

  const handleManifestFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    setSelectedManifestFile(file ?? null);
    setAnalysisResult(null);
    setDownloadPackage(null);
    setAssignmentMatch(null);
    setBatchManifest(null);
    setManifestError(null);
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Batch JSON must be 5 MB or smaller.');
      const parsed = JSON.parse(await file.text()) as EvidenceBatchManifest;
      if (!Array.isArray(parsed.links)) throw new Error('JSON must contain a links array.');
      if (!parsed.links.every((link) => typeof link?.linkId === 'string' && typeof link?.url === 'string' && /^https?:\/\//i.test(link.url))) {
        throw new Error('Every link needs a linkId and a valid http(s) URL.');
      }
      setBatchManifest(parsed);
    } catch (error) {
      setManifestError(error instanceof Error ? error.message : 'Could not read batch JSON.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!/\.zip$/i.test(file.name) || file.size > 100 * 1024 * 1024) { setErrorMessage('Choose a ZIP archive no larger than 100 MB.'); return; }
      setSelectedFile(file);
      setAnalysisResult(null);
      setDownloadPackage(null);
      setErrorMessage(null);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile || manifestError) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setDownloadPackage(null);

    try {
      // Fetch exactly five administrator-managed slots through an authenticated RPC.
      // Password values are not written to report snapshots; only the matched slot/label is saved.
      const { data: configuredCodes, error: codesError } = await supabase.rpc('mfp_get_evidence_zip_passwords');
      if (codesError) throw new Error('Could not retrieve the five ZIP codes. Ask an administrator to configure them in Evidence Control Center.');
      const codes = Array.isArray(configuredCodes) ? configuredCodes.filter((item: any) => item && typeof item.password === 'string' && item.password.trim()) : [];
      if (codes.length !== 5) throw new Error(`Exactly five ZIP codes must be configured by an administrator before analysis. Currently configured: ${codes.length}/5.`);
      setArchivePassword('configured');
      const result = await analyzeUploadedZip(
        selectedFile,
        currentUser?.uid || 'USER',
        currentUser?.email || undefined,
        linksPerFolder,
        batchManifest ?? undefined,
        codes.map((item: any, index: number) => ({ label: String(item.label || `Code ${index + 1}`), password: String(item.password) }))
      );
      setAnalysisResult(result);
      // Match extracted ZIP URLs against this signed-in user's previously assigned links.
      // Unknown URLs are counted for review but never auto-verified or assigned to another user.
      try {
        const matched = await matchUploadedZip(result.extractedUrls.map((x:any) => typeof x === 'string' ? x : (x.normalizedUrl || x.originalUrl || x.url || x.canonicalUrl || '')), result.job.jobId);
        setAssignmentMatch({ matchedCount: matched.matchedCount, unmatchedCount: matched.unmatchedCount, jobId: matched.jobId, matched: Array.isArray(matched.matched) ? matched.matched : [] });
      } catch (matchError) {
        console.warn('ZIP analysis completed but assigned-link reconciliation was unavailable.', matchError);
        setAssignmentMatch(null);
      }
      try { await setDoc(doc(db, 'reportAnalysisSnapshots', result.job.jobId), { jobId: result.job.jobId, job: result.job, passwordMatch: result.passwordMatch, textFileBreakdowns: result.textFileBreakdowns, extractedUrls: result.extractedUrls.slice(0, 500), uniqueEligibleLinks: result.uniqueEligibleLinks.slice(0, 500), extractedScreenshots: result.extractedScreenshots.slice(0, 500).map(({ blob, dataUrl, ...item }) => item), savedAt: new Date().toISOString() }, { merge: true }); } catch (snapshotError) { console.warn('Analysis snapshot could not be saved; current session remains available.', snapshotError); }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Analysis failed. Please check archive structure.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGeneratePackage = async () => {
    if (!analysisResult) return;
    setIsPackaging(true);
    setErrorMessage(null);

    try {
      const pkg = await buildAndDownloadReportPackage({
        job: analysisResult.job,
        linksPerFolder,
        eligibleLinks: analysisResult.uniqueEligibleLinks,
        matchedScreenshots: analysisResult.extractedScreenshots,
        sourceZip: analysisResult.zipInstance,
        batchManifest: analysisResult.batchManifest,
      });
      setDownloadPackage(pkg);
      setActiveTab('PACKAGING');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Packaging generation failed.');
    } finally {
      setIsPackaging(false);
    }
  };

  // Triggers browser download for a blob
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Calculations for folders
  const totalEligible = analysisResult?.uniqueEligibleLinks.length || 0;
  const calculatedFoldersCount = Math.max(1, Math.ceil(totalEligible / Math.max(1, linksPerFolder)));

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Evidence Pipeline
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            ZIP Analysis & Screenshot Matching
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin-only, all-team report generation: ingest evidence ZIP archives, match records across every team, and package output bundles.
          </p>
        </div>
      </div>

      {assignmentMatch && (
        <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-sm font-bold text-emerald-900">Assigned-link reconciliation complete</h2>
          <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Matched assigned links</p><p className="text-2xl font-bold text-emerald-800">{assignmentMatch.matchedCount}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Unmatched URLs</p><p className="text-2xl font-bold text-slate-800">{assignmentMatch.unmatchedCount}</p></div></div>
          <p className="mt-2 text-xs leading-5 text-emerald-900">Only links already assigned in the system were confirmed and marked received. Unknown links remain unmatched for review; they are not automatically verified.</p>
          {assignmentMatch.matched.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-emerald-100 bg-white"><table className="min-w-full text-left text-xs"><thead className="bg-emerald-50 text-emerald-900"><tr><th className="p-3">MFP Profile ID</th><th className="p-3">Internal Profile ID</th><th className="p-3">Owner UID</th><th className="p-3">Platform</th><th className="p-3">Matched URL</th><th className="p-3">Assignment ID</th></tr></thead><tbody className="divide-y divide-slate-100">{assignmentMatch.matched.slice(0, 200).map((item) => <tr key={item.assignmentId}><td className="p-3 font-mono font-bold text-blue-700">{item.mfpProfileId || '—'}</td><td className="p-3 font-mono">{item.profileId}</td><td className="p-3 font-mono">{item.assignedTo}</td><td className="p-3">{item.platform}</td><td className="max-w-sm break-all p-3"><a href={item.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{item.url}</a></td><td className="p-3 font-mono">{item.assignmentId}</td></tr>)}</tbody></table>{assignmentMatch.matched.length > 200 && <p className="p-3 text-[11px] text-slate-500">Showing first 200 matched assignments; all matches remain recorded server-side.</p>}</div>}
        </section>
      )}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Upload Zone */}
      {snapshotLoading && !analysisResult && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading saved analysis results…</div>}
      {savedSnapshot && !analysisResult && !snapshotLoading && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Saved report analysis</p><h2 className="mt-1 text-lg font-bold text-slate-950">{savedSnapshot.job?.sourceArchiveName || savedSnapshot.jobId}</h2><p className="mt-1 text-xs text-slate-600">Job {savedSnapshot.jobId} · Saved {savedSnapshot.savedAt ? new Date(savedSnapshot.savedAt).toLocaleString() : 'date unavailable'}</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[savedSnapshot.job?.inputLinkCount ?? savedSnapshot.extractedUrls?.length ?? 0,'Input links'],[savedSnapshot.job?.uniqueLinkCount ?? savedSnapshot.uniqueEligibleLinks?.length ?? 0,'Unique eligible'],[savedSnapshot.job?.matchedScreenshotCount ?? 0,'Matched screenshots'],[savedSnapshot.job?.reviewRequiredCount ?? 0,'Needs review']].map(([n,label])=><div key={String(label)} className="rounded-xl bg-white p-3"><p className="text-xl font-bold text-slate-950">{n}</p><p className="text-xs text-slate-600">{label}</p></div>)}</div>{savedSnapshot.passwordMatch && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">ZIP code match: <strong>{savedSnapshot.passwordMatch.label} (slot {savedSnapshot.passwordMatch.slot})</strong> successfully opened <strong>{savedSnapshot.passwordMatch.archiveName || savedSnapshot.job?.sourceArchiveName || 'this ZIP'}</strong>.</p>}<p className="mt-3 text-xs text-slate-600">Saved summary and match metadata restored. The original ZIP file is not stored on the server, so re-upload it if you need to regenerate a package.</p><button type="button" onClick={()=>{setSavedSnapshot(null);window.history.replaceState({},'',window.location.pathname);}} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Start a new analysis</button></section>}
      {!analysisResult && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="bg-white p-8 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors text-center shadow-2xs space-y-4"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <UploadCloud className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {selectedFile ? selectedFile.name : 'Upload Evidence ZIP File'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Drag and drop a .zip file containing link lists and screenshot files, or browse from your device.
            </p>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Max 100MB · ZIP and optional batch JSON · ZIP-bomb limits enabled
          </div>
          <div className="mx-auto grid max-w-2xl gap-3 text-left sm:grid-cols-2">
            <label className="block rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">Optional batch JSON<input type="file" accept=".json,application/json" onChange={handleManifestFileChange} className="mt-2 block w-full text-xs font-normal"/><span className="mt-1 block text-[11px] font-normal text-slate-500">{batchManifest ? `${batchManifest.batchName || batchManifest.batchId || 'Batch manifest'} · ${batchManifest.links.length} links` : selectedManifestFile?.name || 'Use the batch JSON example you provided.'}</span></label>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900"><p className="font-semibold">ZIP password managed by Supabase</p><p className="mt-1 leading-5">The website retrieves exactly five administrator-configured codes from Supabase and tests them sequentially. It records the matching code slot and ZIP filename, without saving the password in the report snapshot.</p>{archivePassword === null && <p className="mt-1 text-emerald-800">Password will be retrieved securely when analysis starts.</p>}</div>
          </div>
          {manifestError && <p role="alert" className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{manifestError}</p>}

          <div className="flex items-center justify-center gap-3 pt-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip,application/zip"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => { setErrorMessage(null); fileInputRef.current?.click(); }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Browse Local Files
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isAnalyzing || !!manifestError}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Archive...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Start Analysis</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results View */}
      {analysisResult && (
        <div className="space-y-6">
          {analysisResult.passwordMatch && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5"><p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">ZIP password match confirmed</p><h2 className="mt-1 text-lg font-bold text-emerald-950">{analysisResult.passwordMatch.archiveName}</h2><p className="mt-1 text-sm text-emerald-900">Successfully decrypted using <strong>{analysisResult.passwordMatch.label}</strong> — slot <strong>{analysisResult.passwordMatch.slot} of 5</strong>. The other codes were not needed after this match.</p></section>}
          {/* Header Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Input Links</span>
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {analysisResult.extractedUrls.length}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Unique Eligible</span>
              <span className="text-xl font-bold font-mono text-blue-700 tabular-nums">
                {analysisResult.uniqueEligibleLinks.length}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Screenshots Found</span>
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {analysisResult.extractedScreenshots.length}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Matched Shots</span>
              <span className="text-xl font-bold font-mono text-blue-700 tabular-nums">
                {analysisResult.extractedScreenshots.filter((s) => s.status === 'MATCHED').length}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Unmatched Shots</span>
              <span className="text-xl font-bold font-mono text-amber-600 tabular-nums">
                {analysisResult.extractedScreenshots.filter((s) => s.status === 'UNMATCHED').length}
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Needs Review</span>
              <span className="text-xl font-bold font-mono text-rose-600 tabular-nums">
                {analysisResult.job.reviewRequiredCount}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-md">
            <button
              onClick={() => setActiveTab('LINKS')}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'LINKS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Extracted Links ({analysisResult.extractedUrls.length})
            </button>
            <button
              onClick={() => setActiveTab('SCREENSHOTS')}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'SCREENSHOTS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Screenshots ({analysisResult.extractedScreenshots.length})
            </button>
            <button
              onClick={() => setActiveTab('PACKAGING')}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'PACKAGING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Packaging & Export
            </button>
          </div>

          {/* Tab 1: Extracted Links */}
          {activeTab === 'LINKS' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Discovered URLs & Supabase Match Outcomes
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Priority: 1. Exact ID · 2. SRC reference · 3. Normalized URL · 4. Canonical platform key
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Normalized URL</th>
                      <th className="py-2.5 px-3">Platform</th>
                      <th className="py-2.5 px-3">Matched Profile ID</th>
                      <th className="py-2.5 px-3">Match Method</th>
                      <th className="py-2.5 px-3 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {analysisResult.extractedUrls.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-950 max-w-xs truncate">
                          {u.normalizedUrl}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{u.platform}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {u.matchedProfileId ? (
                            <span className="font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded">
                              {u.matchedProfileId}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unregistered</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] text-slate-600 font-mono">
                            {u.matchMethod.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {u.status === 'MATCHED' ? (
                            <span className="text-blue-700 font-semibold">100%</span>
                          ) : (
                            <span className="text-slate-400">0%</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Screenshots Matching */}
          {activeTab === 'SCREENSHOTS' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Discovered Screenshots & Defensible Identity Match
                </h3>
                <p className="text-[11px] text-slate-500">
                  Screenshots are mapped solely using exact profile or post identity rules. Unmapped screenshots are excluded from matched output.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">File Path / Name</th>
                      <th className="py-2.5 px-3">File Size</th>
                      <th className="py-2.5 px-3">Matched Target</th>
                      <th className="py-2.5 px-3">Match Method</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {analysisResult.extractedScreenshots.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-950 max-w-xs truncate">
                          {s.path}
                          {s.batchLinkId && <span className="mt-1 block text-[10px] text-blue-600">Batch link: {s.batchLinkId}</span>}
                          {s.duplicateChecksum && <span className="mt-1 block text-[10px] font-semibold text-amber-700">Duplicate checksum · review required</span>}
                          {s.reviewNote && <span className="mt-1 block text-[10px] text-amber-700">{s.reviewNote}</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] tabular-nums">
                          {(s.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {s.matchedPostId ? (
                            <span className="text-blue-700 font-semibold">Post: {s.matchedPostId}</span>
                          ) : s.matchedProfileId ? (
                            <span className="text-blue-700 font-semibold">Profile: {s.matchedProfileId}</span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[10px] font-mono text-slate-600">
                          {s.matchMethod.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              s.status === 'MATCHED'
                                ? 'bg-blue-50 text-blue-700'
                                : s.status === 'NEEDS_REVIEW'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Packaging & Folder Target Configuration */}
          {activeTab === 'PACKAGING' && (
            <div className="space-y-6">
              {/* Folder Configuration Form */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Output Folder Configuration & Link Target
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Links Per TXT File / Folder *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      value={linksPerFolder}
                      onChange={(e) => setLinksPerFolder(Math.min(2000, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full p-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">Default: 100 links</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500 block text-[11px]">Eligible Unique Links</span>
                    <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                      {totalEligible}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500 block text-[11px]">Output Folders Needed</span>
                    <span className="text-lg font-bold font-mono text-blue-700 tabular-nums">
                      {calculatedFoldersCount} {calculatedFoldersCount === 1 ? 'Folder' : 'Folders'}
                    </span>
                  </div>
                </div>

                {linksPerFolder > totalEligible && totalEligible > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Target links per file ({linksPerFolder}) exceeds total eligible links ({totalEligible}). Single output folder will contain {totalEligible} links.
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGeneratePackage}
                    disabled={isPackaging || totalEligible === 0}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 shadow-2xs disabled:opacity-50"
                  >
                    {isPackaging ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Assembling Report Package...</span>
                      </>
                    ) : (
                      <>
                        <FolderArchive className="w-3.5 h-3.5" />
                        <span>Generate Physical + Online Reports</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Download Package Area */}
              {downloadPackage && (
                <div className="bg-blue-50/60 p-6 rounded-xl border border-blue-200 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-950">
                      Report Package Generated Successfully
                    </h3>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    Physical ZIP contains per-folder links.txt files with URLs only and a separate Screenshots folder. Online ZIP contains screenshots PDF (numbered parts for large evidence sets) plus links.zip with the same configurable folder structure. Review and duplicate-checksum flags are preserved.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        triggerDownload(
                          downloadPackage.packageZipBlob,
                          `MF-MPanel-Physical-Report-${analysisResult.job.jobId}.zip`
                        )
                      }
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Physical Report ZIP</span>
                    </button>

                    <button type="button" onClick={() => triggerDownload(downloadPackage.onlinePackageZipBlob, `MF-MPanel-Online-Report-${analysisResult.job.jobId}.zip`)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"><Download className="h-3.5 w-3.5"/><span>Download Online Report ZIP</span></button>
                    <button type="button" onClick={() => triggerDownload(downloadPackage.screenshotsPdfBlob, `MF-MPanel-Screenshots-${downloadPackage.screenshotsPdfPartCount > 1 ? 'Part-001' : 'Complete'}-${analysisResult.job.jobId}.pdf`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"><FileText className="h-3.5 w-3.5"/><span>{downloadPackage.screenshotsPdfPartCount > 1 ? `Download PDF Part 1/${downloadPackage.screenshotsPdfPartCount}` : 'Download Screenshots PDF'}</span></button>
                    <button type="button" onClick={() => triggerDownload(downloadPackage.linksZipBlob, `MF-MPanel-Links-${analysisResult.job.jobId}.zip`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"><FolderArchive className="h-3.5 w-3.5"/><span>Download Links ZIP</span></button>

                    <button
                      type="button"
                      onClick={() =>
                        triggerDownload(downloadPackage.linkTxtBlob, 'Link.txt')
                      }
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download Link.txt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        triggerDownload(downloadPackage.screenshotsZipBlob, 'Screenshots.zip')
                      }
                      className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Download Screenshots.zip</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
