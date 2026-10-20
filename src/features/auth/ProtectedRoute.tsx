import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, workspaceSelectionKey } from './AuthContext';
import { ModuleKey } from '../../types/user';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: ModuleKey;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredModule,
  requireAdmin,
}) => {
  const { currentUser, userProfile, isLoading, isAdmin, isTeamAdmin, hasModuleAccess, profileLoadError } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-xs font-semibold text-slate-700">Verifying session...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (currentUser && profileLoadError) {
    return <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10"><div className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-bold text-slate-950">Account profile could not be loaded</h1><p className="text-sm text-slate-600">Supabase Auth sign-in exists, but the app could not verify your Supabase database profile. MF MPanel has blocked workspace access rather than guessing your role or team.</p><p className="text-xs text-slate-500">Please retry. If this continues, contact your administrator with the time of the error.</p><button onClick={() => window.location.reload()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Retry profile check</button></div></main>;
  }

  if (currentUser && userProfile?.accountStatus === 'DISABLED' && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  if (!isAdmin && userProfile?.accountStatus === 'PENDING' && location.pathname !== '/pledge' && location.pathname !== '/select-team') {
    return <Navigate to={userProfile.pledgeAccepted ? '/select-team' : '/pledge'} replace />;
  }

  const assignedTeams = (userProfile?.allowedModules ?? []).filter((m) => ['searching','checking','reports','evidence'].includes(m));
  let workspaceChosen = false;
  try { workspaceChosen = !!currentUser && sessionStorage.getItem(workspaceSelectionKey(currentUser.uid)) === 'true'; } catch {}
  if (!isAdmin && assignedTeams.length > 1 && !workspaceChosen && location.pathname !== '/select-team' && location.pathname !== '/pledge') {
    return <Navigate to="/select-team" replace state={{ from: location }} />;
  }

  if (!isAdmin && location.pathname !== '/select-team' && location.pathname !== '/pledge' && (!userProfile || userProfile.teamConfirmed !== true || !(userProfile.allowedModules ?? []).some((m) => ['searching','checking','reports','evidence'].includes(m)))) {
    return <Navigate to="/select-team" replace />;
  }

  if (requireAdmin && !isAdmin && !(isTeamAdmin && location.pathname === '/admin/analytics')) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Administrative privileges are required to view this module. Please contact an administrator or sign in with an authorized account.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  if (requiredModule && !isAdmin && userProfile?.team !== requiredModule && (userProfile?.allowedModules ?? []).includes(requiredModule)) {
    return <Navigate to="/select-team" replace state={{ requestedTeam: requiredModule }} />;
  }

  if (requiredModule && !hasModuleAccess(requiredModule)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 text-center shadow-xs">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Module Access Restricted</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Your account does not currently have permissions enabled for the <strong>{requiredModule}</strong> module.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
