import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthContext';
import { authErrorMessage } from '../../utils/authErrors';

type LinkState = 'checking' | 'ready' | 'expired';

/** Landing page for the password-recovery email link. */
export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let resolved = false;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlError = query.get('error_description') || hash.get('error_description') || query.get('error') || hash.get('error') || query.get('error_code') || hash.get('error_code');
    let recoveryMarkerAt = 0;
    try { recoveryMarkerAt = Number(window.sessionStorage.getItem('mfp-password-recovery-at') || 0); } catch { /* Ignore unavailable session storage. */ }
    const recoveryMarkerValid = recoveryMarkerAt > 0 && Date.now() - recoveryMarkerAt < 10 * 60 * 1000;
    const recoveryIntent = recoveryMarkerValid || query.get('type') === 'recovery' || hash.get('type') === 'recovery' || query.has('code') || (hash.has('access_token') && hash.get('type') === 'recovery');

    if (urlError) {
      setLinkState('expired');
      return () => { alive = false; };
    }
    if (!recoveryIntent) {
      setLinkState('expired');
      return () => { alive = false; };
    }

    const markReady = () => {
      if (!alive || resolved) return;
      resolved = true;
      setLinkState('ready');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && !!session)) markReady();
    });

    // PKCE links may need a moment to exchange the code for a session. Check the
    // current session as well as listening for the auth callback to avoid races.
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive || resolved) return;
      if (!sessionError && data.session && recoveryIntent) markReady();
    }).catch(() => { /* The timeout below displays the safe expired-link state. */ });

    const timer = window.setTimeout(() => {
      if (alive && !resolved) setLinkState('expired');
    }, 8000);
    return () => { alive = false; window.clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (password.length < 6) return setError('Password kam az kam 6 characters ka hona chahiye.');
    if (password !== confirm) return setError('Passwords match nahi karte.');
    setBusy(true);
    try { await updatePassword(password); setDone(true); window.setTimeout(() => navigate('/dashboard', { replace: true }), 1500); }
    catch (err) { setError(authErrorMessage(err, 'update-password')); }
    finally { setBusy(false); }
  };

  const field = 'w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10';
  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-[#eef3ff] via-[#f5f5f7] to-white px-4 py-8">
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Naya password set karein</h1>
        {linkState === 'checking' && <p className="mt-4 text-sm text-slate-600">Link check ho raha hai…</p>}
        {linkState === 'expired' && <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Yeh link expire ho chuka hai ya pehle use ho chuka hai. <Link to="/forgot-password" className="font-semibold underline">Naya reset link mangwayein</Link>.</div>}
        {done && <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />Password update ho gaya. Aapko workspace par le jaya ja raha hai…</div>}
        {linkState === 'ready' && !done && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
            <label className="block text-sm font-medium text-slate-700">Naya password<div className="relative mt-1.5"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} placeholder="Kam az kam 6 characters" /></div></label>
            <label className="block text-sm font-medium text-slate-700">Password dobara likhein<div className="relative mt-1.5"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} placeholder="Password dobara likhein" /></div></label>
            <button type="submit" disabled={busy} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Save ho raha hai…' : 'Password save karein'}</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-500"><Link to="/login" className="font-semibold text-blue-700 hover:underline">Sign in par wapas jayein</Link></p>
      </div>
    </div>
  );
};
