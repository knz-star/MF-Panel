import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const DashboardRedirect: React.FC = () => {
  const { isLoading, isAdmin, isTeamAdmin, userProfile } = useAuth();
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">Loading your workspace…</div>;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isTeamAdmin) return <Navigate to="/admin/analytics" replace />;
  if (userProfile && !userProfile.pledgeAccepted) return <Navigate to="/pledge" replace />;
  if (userProfile?.accountStatus === 'PENDING') return <Navigate to="/select-team" replace />;
  const assigned = (userProfile?.allowedModules ?? []).filter((m) => ['searching','checking','reports','evidence'].includes(m));
  if (assigned.length !== 1) return <Navigate to="/select-team" replace />;
  if (assigned[0] === 'evidence') return <Navigate to="/dashboard/evidence-performance" replace />;
  return <Navigate to={`/${assigned[0]}`} replace />;
};
