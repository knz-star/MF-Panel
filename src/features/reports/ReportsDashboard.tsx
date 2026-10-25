import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileArchive,
  UploadCloud,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  FolderArchive,
  Download,
} from 'lucide-react';
import { listReportJobs } from '../../services/reportService';
import { WhatsAppSupportForCurrentUser } from '../../components/WhatsAppSupportButton';
import { ReportJob } from '../../types/report';

export const ReportsDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const allJobs = await listReportJobs(50);
      setJobs(allJobs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-end"><WhatsAppSupportForCurrentUser/></div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Evidence Packaging
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Report Generator & ZIP Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyze evidence ZIP archives, execute 5-tier identity matching against the shared Supabase workflow records, and assemble packaged download bundles.
          </p>
        </div>
        <Link
          to="/reports/new"
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>New ZIP Analysis</span>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white/90 rounded-[24px] border border-white shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
            Total Report Jobs
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 tabular-nums">
            {loading ? '—' : jobs.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Processed archive sessions</div>
        </div>

        <div className="p-5 bg-white/90 rounded-[24px] border border-white shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
            Packaging Ready
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 tabular-nums">
            {loading
              ? '—'
              : jobs.filter((j) => j.processingStatus === 'READY_TO_PACKAGE' || j.processingStatus === 'COMPLETED').length}
          </div>
          <div className="text-[10px] text-blue-600 font-medium mt-1">
            Matched & ready for export
          </div>
        </div>

        <div className="p-5 bg-white/90 rounded-[24px] border border-white shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
            Retention Lifecycle
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 tabular-nums">
            72h
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Auto-cleanup policy active
          </div>
        </div>
      </div>

      {/* Past Jobs List */}
      <div className="bg-white/90 rounded-[24px] border border-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Analysis & Packaging Jobs
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading report jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-3">
            <div>No report jobs started yet. Upload a ZIP archive to begin evidence matching.</div>
            <div>
              <Link
                to="/reports/new"
                className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors inline-block"
              >
                Upload First ZIP
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Archive Name</th>
                  <th className="py-3 px-4 text-center">Input Links</th>
                  <th className="py-3 px-4 text-center">Matched Shots</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {jobs.map((job) => (
                  <tr key={job.jobId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {job.jobId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {job.sourceArchiveName}
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums">
                      {job.inputLinkCount}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-blue-700 font-semibold tabular-nums">
                      {job.matchedScreenshotCount}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wide ${
                          job.processingStatus === 'COMPLETED' || job.processingStatus === 'READY_TO_PACKAGE'
                            ? 'bg-blue-50 text-blue-700'
                            : job.processingStatus === 'NEEDS_REVIEW'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {job.processingStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/reports/new?jobId=${encodeURIComponent(job.jobId)}`}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        Open Workspace
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
