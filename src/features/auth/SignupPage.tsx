import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useLandingAssets } from '../landing/useLandingData';

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signupWithEmail } = useAuth();
  const { assets: siteAssets } = useLandingAssets();
  const siteBanner = siteAssets.find((asset) => asset.assetType === 'banner')?.imageUrl || 'https://i.postimg.cc/P5hbxNy7/20261015-112236.jpg';
  const navigate = useNavigate();

  const friendlyError = (err: unknown) => {
    const code = (err as { code?: string })?.code;
    if (code === 'user_already_exists' || code === 'auth/email-already-in-use') return 'Is email par account pehle se bana hua hai. Login karein ya Forgot password use karein.';
    if (code === 'weak_password' || code === 'auth/weak-password') return 'Password kam az kam 6 characters ka hona chahiye.';
    if (code === 'invalid_email' || code === 'auth/invalid-email') return 'Email address valid nahi hai.';
    if (code === 'provider-disabled') return 'Supabase Dashboard → Authentication → Providers mein Email provider enable karein.';
    if (code === 'invalid-api-key') return 'Supabase publishable key invalid hai. Project URL aur publishable key check karein.';
    if (code === 'permission-denied' || code === '42501') return 'Account create ho sakta hai, lekin profile load nahi hui. Dobara login karein; admin review aur team assignment ke baad workspace show hoga.';
    return 'Account create nahi ho saka. Email check karein aur dobara koshish karein; agar masla rahe to admin se rabta karein.';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fullName.trim()) return setError('Apna full name enter karein.');
    if (!gender) return setError('Please select Male or Female.');
    if (password.length < 6) return setError('Password kam az kam 6 characters ka hona chahiye.');
    if (password !== confirmPassword) return setError('Passwords match nahi karte.');
    setIsSubmitting(true);
    try {
      await signupWithEmail(fullName.trim(), email, password, gender);
      navigate('/pledge', { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Signup submitted.')) {
        setSuccess(err.message);
        setError(null);
      } else {
        setDiagnosticError(err);
        setError(friendlyError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordField = (label: string, value: string, setValue: (value: string) => void, visible: boolean, toggle: () => void, autoComplete: string, placeholder: string) => (
    <label className="block text-sm font-medium text-slate-700">{label}
      <div className="relative mt-1.5">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type={visible ? 'text' : 'password'} required autoComplete={autoComplete} minLength={6} value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-12 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10" placeholder={placeholder} />
        <button type="button" onClick={toggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-[#eef3ff] via-[#f5f5f7] to-white px-4 py-8 sm:px-6">
      <div className="mx-auto mb-6 w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)]">
        <img src={siteBanner} alt="MF MPanel banner" className="block aspect-video w-full object-cover" />
      </div>
      <div className="mx-auto w-full max-w-md text-center"><Link to="/" className="mb-5 inline-flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">MF</span><span className="text-xl font-semibold tracking-tight text-slate-950">MF MPanel</span></Link><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Create your account</h1><p className="mt-2 text-sm text-slate-600">Create your account, sign the Urdu pledge, then wait for admin review and team assignment.</p></div>
      <div className="mx-auto mt-8 w-full max-w-md rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-8">
        {success && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success} <Link to="/login" className="font-semibold underline">Go to sign in</Link></div>}
        {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{error}</span></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Full name<div className="relative mt-1.5"><User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600" placeholder="Your name" /></div></label>
          <label className="block text-sm font-medium text-slate-700">Email address<div className="relative mt-1.5"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-600" placeholder="you@example.com" /></div></label>
          <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-medium text-slate-700">Gender</legend><div className="grid grid-cols-2 gap-3"><label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${gender === 'male' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}><input type="radio" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} required className="accent-blue-600"/>Male</label><label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${gender === 'female' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700'}`}><input type="radio" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} required className="accent-blue-600"/>Female</label></div><p className="mt-2 text-xs leading-5 text-slate-500">Your selection helps administrators route you to the appropriate team. It does not grant access by itself.</p></fieldset>
          {passwordField('Password', password, setPassword, showPassword, () => setShowPassword((v) => !v), 'new-password', 'At least 6 characters')}
          {passwordField('Confirm password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword((v) => !v), 'new-password', 'Repeat password')}
          <p className="text-xs leading-5 text-slate-500">Team access is assigned by an administrator after your pledge is submitted and reviewed.</p>
          <button type="submit" disabled={isSubmitting} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">{isSubmitting ? 'Creating account…' : 'Create account'}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-blue-700 hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
};
