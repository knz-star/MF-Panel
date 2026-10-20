import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const DashboardRedirect: React.FC = () => {
  const { isLoading, isAdmin, isTeamAdmin, userProfile } = useAuth();
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">Loading your workspace…</div>;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isTeamAdmin) return <Navigate to="/admin/analytics" replace />;
  if (userProfile && !userProfile.pledgeAccepted) return <Navigate to="/pledge" replace />;
  if (userProfile?.accountStatus !== 'ACTIVE') return <Navigate to="/pending-approval" replace />;
  const allowed = (userProfile?.allowedModules ?? []).filter((m) => ['searching','checking','reports','evidence'].includes(m));
  const team = userProfile?.team;
  if (!team || !allowed.includes(team) || userProfile?.teamConfirmed !== true) return <Navigate to="/pending-approval" replace />;
  if (team === 'evidence') return <Navigate to="/dashboard/evidence-linking" replace />;
  if (team === 'reports') return <Navigate to="/workspace/reports" replace />;
  return <Navigate to={`/${team}`} replace />;
};
