import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useLandingAssets } from '../landing/useLandingData';
import { authErrorMessage } from '../../utils/authErrors';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginWithEmail } = useAuth();
  const { assets: siteAssets } = useLandingAssets();
  const siteBanner = siteAssets.find((asset) => asset.assetType === 'banner')?.imageUrl || 'https://i.postimg.cc/P5hbxNy7/20261015-112236.jpg';
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';

  const friendlyError = (err: unknown) => authErrorMessage(err, 'login');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDiagnosticError(null);
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setDiagnosticError(err);
      setError(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-[#eef3ff] via-[#f5f5f7] to-white px-4 py-8 sm:px-6">
      <div className="mx-auto mb-6 w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)]">
        <img src={siteBanner} alt="MF MPanel banner" loading="eager" decoding="async" onError={(event) => { const image = event.currentTarget; if (!image.dataset.fallback) { image.dataset.fallback = 'true'; image.src = '/mf-auth-banner-fallback.svg'; } else { image.style.display = 'none'; } }} className="block aspect-video w-full object-cover" />
      </div>
      <div className="mx-auto w-full max-w-md text-center">
        <Link to="/" className="mb-5 inline-flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">MF</span><span className="text-xl font-semibold tracking-tight text-slate-950">MF MPanel</span></Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Sign in to your account</h1>
        <p className="mt-2 text-sm text-slate-600">Use your Supabase Auth account to continue.</p>
      </div>
      <div className="mx-auto mt-8 w-full max-w-md rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><p className="text-xs leading-relaxed text-slate-600">Admin permissions are verified server-side through the protected Supabase profile and RLS. There is no one-click or simulated admin login.</p></div>
        {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{error}</span></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Email address<div className="relative mt-1.5"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10" placeholder="you@example.com" /></div></label>
          <label className="block text-sm font-medium text-slate-700">Password<div className="relative mt-1.5"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-12 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10" placeholder="Your password" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
          <div className="flex justify-end"><Link to="/forgot-password" className="text-xs font-medium text-blue-700 hover:underline">Forgot password?</Link></div>
          <button type="submit" disabled={isSubmitting} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">{isSubmitting ? 'Signing in…' : 'Sign in'}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New to MF MPanel? <Link to="/signup" className="font-semibold text-blue-700 hover:underline">Create account</Link></p>
      </div>
    </div>
  );
};
