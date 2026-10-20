import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock3, RefreshCw, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabase';

export const PendingApprovalPage: React.FC = () => {
  const { currentUser, userProfile, refreshProfile, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  useEffect(() => { if (userProfile?.accountStatus === 'ACTIVE' && userProfile.teamConfirmed && userProfile.team && userProfile.allowedModules?.includes(userProfile.team)) navigate('/dashboard', { replace: true }); }, [userProfile, navigate]);
  const check = async () => {
    setChecking(true); setMessage('');
    try {
      await refreshProfile();
      const { data, error } = await supabase.from('mfp_user_profiles').select('account_status,team_key,team_confirmed,allowed_modules').eq('user_id', currentUser?.uid ?? '').maybeSingle();
      if (error) throw error;
      const allowed = Array.isArray(data?.allowed_modules) ? data.allowed_modules : [];
      if (data?.account_status === 'ACTIVE' && data?.team_confirmed && data?.team_key && allowed.includes(data.team_key)) navigate('/dashboard', { replace: true });
      else setMessage('Approval or a single team assignment is still pending. Please try again after your administrator updates access.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not refresh your access status.'); }
    finally { setChecking(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-9"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Clock3 className="h-7 w-7"/></span><p className="mt-5 text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">MF MPanel access</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Waiting for admin approval</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your account is signed in as <strong>{currentUser?.email}</strong>. Your workspace opens automatically after an administrator activates your account and assigns one team.</p><div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs leading-5 text-slate-600"><p><strong className="text-slate-800">Account status:</strong> {userProfile?.accountStatus ?? 'Not available'}</p><p><strong className="text-slate-800">Assigned team:</strong> {userProfile?.team ?? 'Not assigned'}</p><p className="mt-2 inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4"/> No workspace selection is required.</p></div>{message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-left text-xs text-blue-900">{message}</p>}<button type="button" disabled={checking} onClick={() => void check()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${checking?'animate-spin':''}`}/>{checking?'Checking access…':'Check access again'}</button><button type="button" onClick={() => void logout().then(() => navigate('/login',{replace:true}))} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut className="h-4 w-4"/>Sign out</button><p className="mt-5 text-[11px] text-slate-400"><Link to="/" className="hover:text-slate-700">Back to home</Link></p></section></main>;
};
