import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Activity, CheckCircle2, Copy, Link2, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Unplug, XCircle, Sparkles, CircleHelp } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { cancelPairing, createPairing, disconnectEvidence, watchEvidenceRegistration, type EvidenceRegistration } from '../../services/evidenceLinkingService';
import { ErrorDiagnosticPanel } from '../../components/ErrorDiagnosticPanel';

const friendlyError = (error: unknown) => {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (code.includes('invalid-pairing-code') || message.includes('invalid, expired, or already used')) return 'This code is not active anymore. Generate a fresh code and enter all 6 digits within 10 minutes.';
  if (message.includes('same mf mpanel account') || message.includes('account mismatch')) return 'Account mismatch: sign in to MF Evidence with the same MF MPanel account that generated this code.';
  if (code.includes('functions/not-found') || code.includes('not-found')) return 'The Evidence linking endpoint could not be found. Check the mfp-evidence-linking deployment.';
  if (code.includes('functions/unavailable') || code.includes('unavailable')) return 'Supabase is temporarily unreachable. Check your internet connection and retry.';
  if (code.includes('functions/internal') || code.includes('internal')) return 'The linking service returned a server error. Check Supabase Edge Function logs and retry.';
  if (code.includes('resource-exhausted')) return 'Too many active codes. Cancel an old code or wait for it to expire.';
  if (code.includes('permission-denied')) return 'Your account is not authorized for Evidence access. Confirm your team assignment and use the same account on both devices.';
  if (code.includes('failed-precondition')) return error instanceof Error ? error.message : 'Your team assignment needs approval.';
  if (code.includes('unauthenticated')) return 'Your session expired. Sign in again.';
  return 'We could not complete this request. Check your connection and try again.';
};
const dateLabel = (value?: string | { seconds: number } | null) => { if (!value) return 'Not available yet'; const date = typeof value === 'string' ? new Date(value) : new Date(value.seconds * 1000); return Number.isNaN(date.getTime()) ? 'Not available yet' : date.toLocaleString(); };

export const EvidenceLinkingPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [registration, setRegistration] = useState<EvidenceRegistration | null>(null);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [diagnosticError, setDiagnosticError] = useState<unknown>(null);
  const [requestId, setRequestId] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!currentUser?.uid) return;
    return watchEvidenceRegistration(currentUser.uid, setRegistration, (e) => { setDiagnosticError(e); setError('Live connection status could not be read from Supabase.'); });
  }, [currentUser?.uid]);
  useEffect(() => {
    if (!expiresAt) { setSecondsLeft(0); return; }
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer);
  }, [expiresAt]);
  const isEvidenceTeam = userProfile?.team === 'evidence';
  const teamAuthorized = userProfile?.accountStatus === 'ACTIVE' && ((userProfile?.teamConfirmed === true && isEvidenceTeam) || userProfile?.role === 'ADMIN');
  const status = useMemo(() => {
    if (registration?.status === 'REVOKED') return 'Access Revoked';
    if (registration?.status === 'ACTIVE' && registration.activationStatus === 'ACTIVE' && registration.userVerified && registration.teamAuthorized) return 'Activated';
    if (code && secondsLeft > 0) return 'Waiting for App';
    if (code && secondsLeft === 0) return 'Code Expired';
    return 'Not Linked';
  }, [registration, code, secondsLeft]);
  if (userProfile && userProfile.role !== 'ADMIN' && !isEvidenceTeam) return <Navigate to="/dashboard" replace />;
  const generate = async () => {
    setBusy(true); setError(''); setDiagnosticError(null); setMessage(''); setCopied(false);
    try {
      if (requestId) await cancelPairing(requestId).catch(() => undefined);
      const result = await createPairing();
      const exactCode = String(result.code ?? '').replace(/\D/g, '').padStart(6, '0').slice(-6);
      if (!/^\d{6}$/.test(exactCode)) throw new Error('The server did not return a valid six-digit code.');
      setCode(exactCode); setExpiresAt(result.expiresAt); setRequestId(result.requestId);
      setMessage('Code ready. Enter it in MF Evidence within 10 minutes. Use the same signed-in account on both devices.');
    } catch (e) { setDiagnosticError(e); setError(friendlyError(e)); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    const exactCode = String(code).replace(/\D/g, '').padStart(6, '0').slice(-6);
    try { await navigator.clipboard.writeText(exactCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Automatic copy is blocked by this browser. Select the six digits and copy them manually.'); }
  };
  const disconnect = async () => {
    if (!window.confirm('Disconnect MF Evidence? App access will be revoked until you pair again.')) return;
    setBusy(true); setError(''); setDiagnosticError(null); setMessage('');
    try { await disconnectEvidence(); setCode(''); setExpiresAt(0); setRequestId(''); setMessage('Evidence app access has been revoked. Generate a new code to reconnect.'); }
    catch (e) { setDiagnosticError(e); setError(friendlyError(e)); }
    finally { setBusy(false); }
  };
  const active = status === 'Activated';
  return <main className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#101014] p-4 text-white shadow-2xl shadow-slate-950/20 sm:p-7 lg:p-9">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-blue-600/30 blur-[100px]"/><div className="absolute -right-28 top-1/3 h-80 w-80 rounded-full bg-violet-600/25 blur-[100px]"/><div className="absolute -bottom-44 -left-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px]"/></div>
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 shadow-lg shadow-blue-950/30"><Smartphone className="h-7 w-7 text-white"/></div><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-violet-200"><Sparkles className="h-3.5 w-3.5"/> MF MPANEL · EVIDENCE</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Connect your device</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Securely link your Android Evidence app to your MF MPanel account with a one-time code.</p></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[0.06] text-white/75'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-300' : 'bg-amber-300'}`}/>{status}</span></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/45">Signed-in account</p><p className="mt-1 break-all text-sm font-semibold text-white">{currentUser?.email || 'Signed-in MF MPanel account'}</p><p className="mt-2 text-xs text-white/45">Keep this same account signed in on Android.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs text-white/45">Team authorization</p><p className="mt-1 text-sm font-semibold text-white">{teamAuthorized ? (userProfile?.role === 'ADMIN' ? 'Administrator authorized' : userProfile?.team || 'Evidence team') : 'Approval required'}</p><p className="mt-2 text-xs text-white/45">Server verifies authorization before linking.</p></div></div>
      {error && <div className="mt-4 space-y-2"><div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div><ErrorDiagnosticPanel error={diagnosticError ?? error}/></div>}
      {message && <div role="status" className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div>}
    </section>
    {!active ? <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl sm:p-7"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-200"/><h2 className="font-semibold">One-time pairing code</h2></div><p className="mt-2 text-sm leading-6 text-white/55">Create a fresh code and enter it in MF Evidence. Codes expire after 10 minutes and can only be used once.</p>
        {code && secondsLeft > 0 ? <div className="mt-6 rounded-3xl border border-violet-300/25 bg-gradient-to-br from-violet-500/20 via-blue-500/10 to-white/[0.03] p-5 sm:p-7"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-violet-100/75">Your pairing code</p><span className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium text-white/75">{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')} left</span></div><div aria-label={`Pairing code ${code.split('').join(' ')}`} className="mt-5 flex justify-between gap-1 sm:gap-2">{code.split('').map((digit,index)=><span key={`${index}-${digit}`} className="grid h-12 min-w-0 flex-1 place-items-center rounded-xl border border-white/15 bg-black/25 font-mono text-2xl font-bold tracking-normal text-white shadow-inner sm:h-16 sm:text-3xl">{digit}</span>)}</div><button onClick={copy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#17151e] transition hover:bg-violet-50"><Copy className="h-4 w-4"/>{copied ? 'Copied — paste into MF Evidence' : 'Copy 6-digit code'}</button><p className="mt-3 text-center text-xs text-white/45">Copied as exactly six digits, including any leading zero.</p></div> : <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-black/20 p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Link2 className="h-6 w-6 text-white/70"/></div><p className="mt-3 text-sm font-semibold text-white">No active code</p><p className="mt-1 text-xs text-white/45">Generate a new code to begin linking.</p></div>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={generate} disabled={busy || active || !teamAuthorized} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : code && secondsLeft === 0 ? <RefreshCw className="h-4 w-4"/> : <Link2 className="h-4 w-4"/>}{code ? 'Generate fresh code' : 'Generate pairing code'}</button>{code && secondsLeft > 0 && <button onClick={async()=>{setBusy(true);try{if(requestId)await cancelPairing(requestId);setCode('');setExpiresAt(0);setRequestId('');setMessage('Unused code cancelled.');}catch(e){setDiagnosticError(e);setError(friendlyError(e));}finally{setBusy(false);}}} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"><XCircle className="h-4 w-4"/>Cancel code</button>}</div>
        {!teamAuthorized && <p className="mt-4 text-xs text-amber-200">Pairing is disabled until your Evidence team assignment is authorized.</p>}
      </div>
      <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur-xl sm:p-7"><h2 className="font-semibold">Finish setup in 3 steps</h2><div className="mt-5 space-y-5">{[{n:'01',title:'Open MF Evidence',body:'On Android, open the app and sign in to the same MF MPanel account shown here.'},{n:'02',title:'Enter all six digits',body:'Choose Link Application. Paste the code exactly as copied; do not add spaces.'},{n:'03',title:'Confirm connection',body:'Tap Verify Connection and keep this website open until the status changes to Activated.'}].map(step=><div key={step.n} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] font-mono text-sm text-violet-200">{step.n}</span><div><h3 className="text-sm font-semibold text-white">{step.title}</h3><p className="mt-1 text-sm leading-6 text-white/50">{step.body}</p></div></div>)}</div><div className="mt-7 rounded-2xl border border-blue-300/15 bg-blue-400/[0.07] p-4"><div className="flex gap-3"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-blue-200"/><div><p className="text-sm font-semibold text-blue-100">Still says “Invalid code”?</p><p className="mt-1 text-xs leading-5 text-white/55">Generate a fresh code and use it right away. Both devices must use the same Supabase-backed account. If it still fails, the Android app needs to call the current <code className="rounded bg-black/30 px-1">mfp-evidence-linking</code> endpoint with its current Supabase access token — a Firebase-only session will not work.</p></div></div></div></div>
    </section> : <section className="mt-4 rounded-[1.6rem] border border-emerald-300/20 bg-emerald-400/[0.06] p-5 backdrop-blur-xl sm:p-7"><div className="flex items-start gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300/10"><CheckCircle2 className="h-6 w-6 text-emerald-200"/></div><div className="flex-1"><h2 className="text-lg font-bold">Application linked and activated</h2><p className="mt-1 text-sm text-white/55">The backend confirmed your device registration and team authorization.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Application','MF Evidence'],['Connection','Linked'],['Activation','Active'],['User verification','Verified'],['Authorized team',registration?.teamId||'Not available'],['Device label',registration?.deviceLabel||'Not provided'],['Last sync',dateLabel(registration?.lastSeenAt)],['Linked at',dateLabel(registration?.linkedAt)]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/45">{label}</p><p className="mt-1 break-words text-sm font-semibold text-white">{value}</p></div>)}</div><button onClick={disconnect} disabled={busy} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300/20 px-4 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-400/10 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Unplug className="h-4 w-4"/>}Disconnect application</button></section>}
    <footer className="mt-4 flex items-start gap-3 px-2 py-2 text-xs leading-5 text-white/40"><Activity className="mt-0.5 h-4 w-4 shrink-0"/><p>Pairing codes are temporary and single-use. A successful code display does not mean the Android app is linked; the status changes only after the backend confirms redemption.</p></footer>
  </main>;
};
