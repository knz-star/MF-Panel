import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, CheckCircle2, FileText, FileArchive, ShieldCheck, LogOut, UserRound, Users, Settings, Activity, Link2, MoreHorizontal, X, Smartphone } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import type { TeamKey } from '../../types/user';
import { ToastHost } from '../ToastHost';

type NavItem = { name: string; path: string; icon: React.ComponentType<{ className?: string }> };

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, isAdmin, isTeamAdmin, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const inferredTeam: TeamKey = userProfile?.team ?? (userProfile?.role === 'CHECKER' ? 'checking' : userProfile?.role === 'SEARCHER' ? 'searching' : userProfile?.allowedModules?.includes('checking') && !userProfile?.allowedModules?.includes('searching') ? 'checking' : userProfile?.allowedModules?.includes('reports') && !userProfile?.allowedModules?.includes('searching') && !userProfile?.allowedModules?.includes('checking') ? 'reports' : 'searching');
  const teamNav: Record<TeamKey, NavItem[]> = {
    searching: [
      { name: 'Searching Workspace', path: '/searching', icon: LayoutDashboard },
      { name: 'Import links', path: '/searching/import', icon: FileArchive },
    ],
    checking: [
      { name: 'Checking Workspace', path: '/checking', icon: LayoutDashboard },
      
    ],
    // Workspace activity reports are team-scoped; the ZIP Report Generator remains Admin-only.
    reports: [
      { name: 'Workspace reports', path: '/workspace/reports', icon: FileText },
      { name: 'Shared reports', path: '/shared-reports', icon: Users },
    ],
    evidence: [
      { name: 'Evidence Pairing', path: '/dashboard/evidence-linking', icon: Smartphone },
      { name: 'Assign Links', path: '/dashboard/get-links', icon: FileArchive },
    ],
  };
  const adminNav: NavItem[] = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'My Profile', path: '/profile', icon: UserRound },
    { name: 'Users & access', path: '/admin/users', icon: Users },
    { name: 'Team analytics', path: '/admin/analytics', icon: Activity },
    { name: 'Male/Female teams', path: '/admin/gender-teams', icon: Users },
    { name: 'Workspace reports', path: '/workspace/reports', icon: FileText },
    { name: 'Shared reports', path: '/shared-reports', icon: Users },
    { name: 'Link management', path: '/admin/links', icon: Link2 },
    { name: 'Site assets', path: '/admin/assets', icon: FileArchive },
    { name: 'Duplicate review', path: '/admin/duplicates', icon: ShieldCheck },
    { name: 'System tests', path: '/admin/tests', icon: Activity },
    { name: 'System Health', path: '/admin/system-health', icon: Activity },
    { name: 'System settings', path: '/settings', icon: Settings },
    { name: 'Workflow history', path: '/activity', icon: FileText },
    { name: 'Evidence App Linking', path: '/dashboard/evidence-linking', icon: Smartphone },
    { name: 'Checking Results', path: '/admin/checking-results', icon: CheckCircle2 },
    { name: 'Searching workspace', path: '/searching', icon: Search },
    { name: 'Checking workspace', path: '/checking', icon: CheckCircle2 },
    { name: 'Report Generator', path: '/reports', icon: FileArchive },
  ];
  // A user may be granted more than one module by an administrator. Keep every
  // permitted workspace visible in the navigation instead of showing only the
  // single legacy `team` field. The backend's allowedModules remains the access source.
  const accessibleTeams = (['searching', 'checking', 'evidence'] as TeamKey[])
    .filter((team) => userProfile?.allowedModules?.includes(team));
  const userNav = [...accessibleTeams.flatMap((team) => teamNav[team]), { name: 'Workspace reports', path: '/workspace/reports', icon: FileText }, { name: 'Shared reports', path: '/shared-reports', icon: Users }, { name: 'My Profile', path: '/profile', icon: UserRound }];
  const managerNav: NavItem[] = [{ name: 'Team analytics', path: '/admin/analytics', icon: Activity }, { name: 'Male/Female team dashboard', path: '/admin/gender-teams', icon: Users }, { name: 'Workspace reports', path: '/workspace/reports', icon: FileText }, { name: 'Shared reports', path: '/shared-reports', icon: Users }, { name: 'My Profile', path: '/profile', icon: UserRound }];
  const allNav = isAdmin ? adminNav : isTeamAdmin ? managerNav : userNav;
  const routeTeam: TeamKey | null = location.pathname.startsWith('/checking') ? 'checking' : (location.pathname.startsWith('/dashboard/evidence') || location.pathname.startsWith('/dashboard/get-links') || location.pathname.startsWith('/evidence')) ? 'evidence' : location.pathname.startsWith('/searching') ? 'searching' : null;
  const primaryTeam = routeTeam ?? inferredTeam;
  const teamHome = (team: TeamKey) => team === 'evidence' ? '/dashboard/evidence-linking' : team === 'reports' ? '/workspace/reports' : `/${team}`;
  const homePath = isAdmin ? '/admin' : isTeamAdmin ? '/admin/analytics' : primaryTeam === 'evidence' ? '/dashboard/evidence-linking' : primaryTeam === 'reports' ? '/workspace/reports' : `/${primaryTeam}`;
  const pageTitle = allNav.find((item) => location.pathname === item.path)?.name || location.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase()) || 'Workspace';
  const isActive = (item: NavItem) => location.pathname === item.path || (item.path !== homePath && location.pathname.startsWith(item.path + '/'));
  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };
  const visibleBottom = isAdmin ? adminNav.slice(0, 3) : isTeamAdmin ? managerNav : allNav.slice(0, 4);
  const moreItems = isAdmin ? adminNav.slice(3) : isTeamAdmin ? [] : allNav.slice(4);
  const NavLink = ({ item, compact = false }: { item: NavItem; compact?: boolean }) => { const Icon = item.icon; return <Link key={item.path} to={item.path} onClick={() => setMoreOpen(false)} aria-current={isActive(item) ? 'page' : undefined} className={`${compact ? 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm' : 'mf-bottom-item'} ${isActive(item) ? (compact ? 'bg-blue-50 text-blue-800 font-semibold' : 'is-active') : (compact ? 'text-slate-600 hover:bg-slate-50' : '')}`}><Icon className={compact ? 'h-4 w-4 shrink-0' : 'h-[23px] w-[23px]'} strokeWidth={isActive(item) ? 2.4 : 1.8}/><span className={compact ? '' : 'mf-bottom-label'}>{item.name}</span>{!compact && isActive(item) && <span className="mf-active-dot"/>}</Link>; };

  return <div className="mf-app-shell min-h-screen text-slate-900"><ToastHost />
    <header className="mf-topbar sticky top-0 z-30"><div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
      <Link to={homePath} className="flex min-w-0 items-center gap-3"><span className="mf-brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-extrabold tracking-tight text-white">MF</span><span><span className="block truncate text-[15px] font-bold tracking-tight text-slate-950">MF MPanel</span><span className="block truncate text-[11px] text-slate-500">{isAdmin ? 'Senior administrator workspace' : isTeamAdmin ? 'Team administrator workspace' : accessibleTeams.length > 1 ? `${accessibleTeams.length} authorized workspaces` : `${primaryTeam === 'searching' ? 'Searching' : primaryTeam === 'checking' ? 'Checking' : primaryTeam === 'evidence' ? 'Evidence Team' : 'Workspace Reports'} workspace`}</span></span></Link>
      <div className="flex items-center gap-2">{!isAdmin && !isTeamAdmin && accessibleTeams.length > 1 && <label className="flex min-w-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold text-slate-700 sm:gap-2 sm:px-3 sm:text-xs"><span className="text-slate-400">Workspace</span><select aria-label="Switch workspace" value={routeTeam ?? ''} onChange={(e) => { const next = e.target.value as TeamKey; if (accessibleTeams.includes(next)) navigate(teamHome(next)); }} className="max-w-[100px] bg-transparent outline-none sm:max-w-[155px]">{accessibleTeams.map(team => <option key={team} value={team}>{team === 'searching' ? 'Searching Team' : team === 'checking' ? 'Checking Team' : team === 'reports' ? 'Report Generator' : 'Evidence Team'}</option>)}</select></label>}<div className="hidden text-right sm:block"><p className="max-w-[230px] truncate text-xs font-semibold text-slate-800">{userProfile?.displayName || currentUser?.email || 'Account'}</p><p className="text-[10px] text-slate-500">{isAdmin ? 'Senior administrator' : isTeamAdmin ? 'Team administrator' : 'Team member'}</p></div><button onClick={() => void handleLogout()} className="mf-logout inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold transition" aria-label="Log out"><LogOut className="h-4 w-4"/><span className="hidden sm:inline">Sign out</span></button></div>
    </div></header>
    <div className={`mx-auto flex w-full max-w-[1500px] ${isAdmin ? 'gap-6 px-4 sm:px-6' : ''}`}>
      {(isAdmin || isTeamAdmin) && <aside className="hidden w-[238px] shrink-0 py-7 lg:block"><div className="sticky top-[88px] rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-3 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-blue-700">Admin navigation</p><nav className="space-y-1">{(isAdmin ? adminNav : managerNav).map(item => <NavLink key={item.path} item={item} compact />)}</nav></div></aside>}
      <main className="min-h-[calc(100vh-68px)] w-full min-w-0 flex-1 pb-28 pt-6 sm:pt-8 md:pb-32"><div className="mf-page-heading mb-6 flex items-end justify-between gap-3"><div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{isAdmin ? 'Control center' : isTeamAdmin ? 'Team management' : 'Your workspace'}</p><nav aria-label="Breadcrumb" className="mb-1 text-[11px] text-slate-500"><Link to="/dashboard" className="hover:text-blue-700">Dashboard</Link><span className="px-2">/</span><span className="capitalize">{location.pathname.split('/').filter(Boolean).join(' / ').replaceAll('-', ' ')}</span></nav><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{pageTitle}</h1></div><span className="hidden rounded-full border border-blue-100 bg-white/75 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm sm:inline-flex">{isAdmin ? 'Full access' : isTeamAdmin ? 'Assigned team only' : 'Team access only'}</span></div><Outlet /></main>
    </div>
    <nav aria-label="Main navigation" className={`mf-bottom-nav fixed inset-x-0 bottom-3 z-40 px-3 sm:bottom-5 ${isAdmin || isTeamAdmin ? 'lg:hidden' : ''}`}><div className="mf-bottom-pill mx-auto grid max-w-[560px] items-center gap-1 rounded-[32px] px-2 py-2 sm:px-4" style={{gridTemplateColumns:`repeat(${visibleBottom.length + (moreItems.length ? 1 : 0)}, minmax(0, 1fr))`}}>{visibleBottom.map(item => <NavLink key={item.path} item={item}/>)}{moreItems.length > 0 && <button type="button" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen} className={`mf-bottom-item ${moreOpen ? 'is-active' : ''}`}><MoreHorizontal className="h-[23px] w-[23px]"/><span className="mf-bottom-label">More</span>{moreOpen && <span className="mf-active-dot"/>}</button>}</div></nav>
    {moreOpen && <><button aria-label="Close navigation menu" className="fixed inset-0 z-40 bg-slate-950/20" onClick={() => setMoreOpen(false)}/><div className="fixed bottom-[88px] left-3 right-3 z-50 mx-auto max-h-[65vh] max-w-[420px] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_20px_70px_rgba(15,23,42,.2)]"><div className="mb-2 flex items-center justify-between px-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{isAdmin ? 'All admin pages' : isTeamAdmin ? 'Team admin pages' : 'More workspace pages'}</p><button onClick={() => setMoreOpen(false)} aria-label="Close" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4"/></button></div>{moreItems.map(item => <NavLink key={item.path} item={item} compact />)}</div></>}
  </div>;
};
