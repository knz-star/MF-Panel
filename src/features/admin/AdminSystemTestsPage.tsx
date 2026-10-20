import React, { useState } from 'react';
import { collection, getDocs, limit, query } from '../../lib/supabaseDocumentStore';
import { Activity, CheckCircle2, CircleAlert, RefreshCw } from 'lucide-react';
import { auth, db, supabaseConfig } from '../../lib/backend';
import { checkSupabaseConnection } from '../../lib/backend';
import { extractUrlsFromChatText } from '../../utils/urlExtractor';

type TestResult = { name: string; status: 'PASS' | 'FAIL' | 'WARN'; detail: string };
const collectionsToCheck = ['users', 'profiles', 'posts', 'checkingRecords', 'reportJobs', 'landingAssets', 'settings', 'workflowEvents'];
export const AdminSystemTestsPage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const runTests = async () => {
    setRunning(true); const out: TestResult[] = [];
    try {
      const connection = await checkSupabaseConnection();
      out.push({ name: 'Supabase connectivity', status: connection.state === 'CONNECTED' ? 'PASS' : 'FAIL', detail: `${connection.state} · project ${connection.projectId}${connection.errorMessage ? ` · ${connection.errorMessage}` : ''}` });
      out.push({ name: 'Authentication session', status: auth.currentUser ? 'PASS' : 'WARN', detail: auth.currentUser ? `Signed in as ${auth.currentUser.email || auth.currentUser.uid}` : 'No signed-in Supabase user in this browser session.' });
      out.push({ name: 'URL extraction smoke test', status: extractUrlsFromChatText('https://example.com/a https://example.org/b').length === 2 ? 'PASS' : 'FAIL', detail: `Found ${extractUrlsFromChatText('https://example.com/a https://example.org/b').length} of 2 test URLs.` });
      if (auth.currentUser) {
        for (const name of collectionsToCheck) {
          try { const snap = await getDocs(query(collection(db, name), limit(1))); out.push({ name: `Supabase database read: ${name}`, status: 'PASS', detail: `Read permitted; sample size ${snap.size}.` }); }
          catch (e) { const err = e as { code?: string; message?: string }; out.push({ name: `Supabase database read: ${name}`, status: 'FAIL', detail: `${err.code || 'error'}: ${err.message || 'Read failed'}` }); }
        }
      } else {
        out.push({ name: 'Supabase database permissions', status: 'WARN', detail: 'Sign in with the admin account before running collection permission tests.' });
      }
    } catch (e) { out.push({ name: 'System test runner', status: 'FAIL', detail: e instanceof Error ? e.message : String(e) }); }
    setResults(out); setLastRun(new Date().toLocaleString()); setRunning(false);
  };
  const failCount = results.filter(r => r.status === 'FAIL').length;
  return <div className="mx-auto max-w-5xl space-y-6"><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Activity className="h-6 w-6"/></span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-slate-950">System diagnostics</h2><p className="mt-1 text-sm text-slate-600">Checks connectivity, URL parsing, authentication and read access for key Supabase database collections. This diagnoses errors; it does not modify security rules or delete data.</p><p className="mt-2 text-xs text-slate-500">Supabase project: <strong>{supabaseConfig.projectId}</strong></p></div><button onClick={() => void runTests()} disabled={running} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{running ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Activity className="h-4 w-4"/>}{running ? 'Testing…' : 'Run tests'}</button></div></div>
    {results.length > 0 && <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Checks run</p><p className="mt-1 text-2xl font-bold">{results.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Failures</p><p className="mt-1 text-2xl font-bold text-rose-700">{failCount}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Last run</p><p className="mt-1 text-sm font-semibold">{lastRun}</p></div></div><div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">{results.map((r,i)=><div key={`${r.name}-${i}`} className="flex items-start gap-3 border-b border-slate-100 p-4 last:border-0"><span className={r.status==='PASS'?'text-blue-700':r.status==='FAIL'?'text-rose-700':'text-amber-600'}>{r.status==='PASS'?<CheckCircle2 className="h-5 w-5"/>:<CircleAlert className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900">{r.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status==='PASS'?'bg-blue-50 text-blue-700':r.status==='FAIL'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700'}`}>{r.status}</span></div><p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{r.detail}</p></div></div>)}</div><p className="text-xs text-slate-500">A failed collection read normally means the deployed Supabase database rules do not allow this signed-in account to read that collection, or the user lacks admin authorization. Update the Supabase RLS policies through a reviewed SQL migration; this page cannot safely change security policies for you.</p></>}
  </div>;
};
