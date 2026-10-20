import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Search, ShieldCheck, LogOut, Smartphone, Layers, type LucideIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { ModuleKey, TeamKey } from '../../types/user';

const options: { key: TeamKey; title: string; description: string; icon: LucideIcon }[] = [
  { key: 'searching', title: 'Searching Team', description: 'Links find aur organize karein.', icon: Search },
  { key: 'checking', title: 'Checking Team', description: 'Links review aur verify karein.', icon: ShieldCheck },
  { key: 'reports', title: 'Workspace Reports', description: 'Daily, weekly aur team activity reports banayein.', icon: FileText },
  { key: 'evidence', title: 'Evidence Team', description: 'Evidence app aur authorized links.', icon: Smartphone },
];

export const TeamSelectionPage: React.FC = () => {
  const { currentUser, userProfile, isAdmin, logout } = useAuth();
  const [selected, setSelected] = useState<TeamKey | null>(null);
  const navigate = useNavigate();
  const assigned = useMemo(() => options.filter((o) => (userProfile?.allowedModules ?? []).includes(o.key as ModuleKey)), [userProfile?.allowedModules]);

  React.useEffect(() => {
    if (isAdmin) navigate('/admin', { replace: true });
    else if (userProfile?.accountStatus !== 'ACTIVE' || userProfile?.pledgeAccepted !== true) return;
    else if (assigned.length === 1) navigate(assigned[0].key === 'evidence' ? '/dashboard/evidence-performance' : assigned[0].key === 'reports' ? '/workspace/reports' : `/${assigned[0].key}`, { replace: true });
  }, [isAdmin, assigned, navigate]);

  const enterTeam = (team: TeamKey) => {
    if (!assigned.some((o) => o.key === team)) return;
    navigate(team === 'evidence' ? '/dashboard/evidence-performance' : team === 'reports' ? '/workspace/reports' : `/${team}`, { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 py-10">
      <section className="w-full max-w-3xl rounded-[32px] border border-white bg-white/90 p-5 shadow-[0_25px_80px_-35px_rgba(15,23,42,.28)] backdrop-blur-xl sm:p-9">
        <Link to="/" className="mb-8 inline-flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">MF</span><span className="text-lg font-semibold tracking-tight text-slate-950">MF MPanel</span></Link>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-700">Your workspaces</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Choose a workspace to enter</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Signed in as {currentUser?.email ?? 'your account'}. Only workspaces enabled by an administrator are shown here. You can switch between all authorized workspaces from the app navigation.</p>
        {userProfile?.accountStatus !== 'ACTIVE' || userProfile?.pledgeAccepted !== true ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>Admin review pending</strong><p className="mt-1">Aapka pledge submit hone ke baad admin approval aur team assignment ka intezar karein. Approval se pehle workspace activate nahi hoga.</p></div> : assigned.length === 0 ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><strong>Team assignment pending</strong><p className="mt-1">Admin review aur kam az kam ek team assign hone ke baad yahan workspace show hoga.</p></div> : <div className="mt-6 grid gap-3 sm:grid-cols-2">{assigned.map(({ key, title, description, icon: Icon }) => { const active = selected === key; return <button key={key} type="button" aria-pressed={active} onClick={() => setSelected(key)} className={`relative min-h-36 rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-4 focus:ring-blue-600/10 ${active ? 'border-blue-600 bg-blue-50/70' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}><span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">{active ? 'Selected workspace' : 'Select workspace'} <ArrowRight className="h-3.5 w-3.5" /></span>{active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-blue-700" />}</button>; })}</div>}
        {assigned.length > 1 && <button type="button" disabled={!selected} onClick={() => selected && enterTeam(selected)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40">Enter selected team <ArrowRight className="h-4 w-4"/></button>}
        <div className="mt-6 flex justify-between border-t border-slate-100 pt-4"><span className="inline-flex items-center gap-2 text-xs text-slate-400"><Layers className="h-4 w-4" /> Workspace access managed by admin</span><button type="button" onClick={() => void logout().then(() => navigate('/login', { replace: true }))} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"><LogOut className="h-4 w-4" /> Sign out</button></div>
      </section>
    </main>
  );
};
