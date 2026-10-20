import React, { useState, useEffect } from 'react';
import { RefreshCw, History, Search, Filter, ShieldCheck } from 'lucide-react';
import { listRecentWorkflowActivity } from '../../services/workflowService';
import { WorkflowEvent } from '../../types/workflow';

export const WorkflowHistoryPage: React.FC = () => {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listRecentWorkflowActivity(100);
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = events.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      e.eventId.toLowerCase().includes(q) ||
      e.profileId.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.actorEmail && e.actorEmail.toLowerCase().includes(q));

    const matchStage = stageFilter === 'ALL' || e.stage === stageFilter;
    return matchSearch && matchStage;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Audit Trail
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Workflow History & State Transitions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of state changes across searching intake, checking verification, and report generation.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh History</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events by Profile ID, Event ID, action, or user..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-slate-800"
        >
          <option value="ALL">All Stages</option>
          <option value="SEARCHING">Searching</option>
          <option value="CHECKING">Checking</option>
          <option value="REPORTING">Reporting</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading audit events...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No workflow events recorded matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Profile ID</th>
                  <th className="py-3 px-4">State Transition</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((evt) => (
                  <tr key={evt.eventId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {evt.eventId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {evt.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {evt.action.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-950">
                      {evt.profileId}
                    </td>
                    <td className="py-3 px-4 text-[11px] font-mono text-slate-600">
                      {evt.previousStatus ? `${evt.previousStatus} → ` : ''}
                      <span className="text-blue-700 font-semibold">{evt.newStatus || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600">
                      {evt.actorEmail || 'System'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums">
                      {new Date(evt.createdAt).toLocaleString()}
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
