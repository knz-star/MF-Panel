import React from 'react';
import { Server, Monitor, Wifi, ShieldAlert, CircleHelp } from 'lucide-react';
import { diagnoseError } from '../utils/errorDiagnostics';

export const ErrorDiagnosticPanel: React.FC<{ error: unknown; compact?: boolean }> = ({ error, compact = false }) => {
  const detail = diagnoseError(error);
  const Icon = detail.source === 'FRONTEND' ? Monitor : detail.source === 'NETWORK' ? Wifi : detail.source === 'SUPABASE_AUTH' ? ShieldAlert : detail.source === 'UNKNOWN' ? CircleHelp : Server;
  const color = detail.source === 'FRONTEND' ? 'violet' : detail.source === 'NETWORK' ? 'amber' : detail.source === 'UNKNOWN' ? 'slate' : 'rose';
  const classes = color === 'violet' ? 'border-violet-200 bg-violet-50 text-violet-900' : color === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : color === 'slate' ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-rose-200 bg-rose-50 text-rose-900';
  return <section className={`rounded-xl border p-4 ${classes}`} role="alert" aria-live="polite">
    <div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0"/><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{detail.title}</h3><span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-bold tracking-wide">{detail.source.replace('_', ' ')}</span></div>
      <p className="mt-1 break-words text-xs leading-5">{detail.message}</p>
      {!compact && <><p className="mt-2 text-[11px] font-semibold">Error code: <code>{detail.code}</code></p><p className="mt-2 text-xs leading-5">{detail.nextStep}</p></>}
    </div></div>
  </section>;
};
