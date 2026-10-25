import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { DashboardRedirect } from '../features/auth/DashboardRedirect';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Public pages
import { LandingPage } from '../features/landing/LandingPage';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { PendingApprovalPage } from '../features/auth/PendingApprovalPage';
import { PledgePage } from '../features/auth/PledgePage';
import { AdminLinksPage } from '../features/admin/AdminLinksPage';

// Searching Team
import { SearchingImportPage } from '../features/searching/SearchingImportPage';
import { SearchingProfilesPage } from '../features/searching/SearchingProfilesPage';
import { SearchingPostsPage } from '../features/searching/SearchingPostsPage';
import { SearchingDuplicatesPage } from '../features/searching/SearchingDuplicatesPage';
import { SearchingHandoffPage } from '../features/searching/SearchingHandoffPage';

// Checking Team
import { CheckingDashboard } from '../features/checking/CheckingDashboard';
import { CheckingRecordPage } from '../features/checking/CheckingRecordPage';

// Report Generator
import { ReportsDashboard } from '../features/reports/ReportsDashboard';
import { NewReportAnalysisPage } from '../features/reports/NewReportAnalysisPage';
import { OrganizationReportsPage } from '../features/reports/OrganizationReportsPage';
import { GenderTeamDashboardPage } from '../features/admin/GenderTeamDashboardPage';

// Admin Panel
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { AdminUsersPage } from '../features/admin/AdminUsersPage';
import { AdminAssetsPage } from '../features/admin/AdminAssetsPage';
import { AdminSystemTestsPage } from '../features/admin/AdminSystemTestsPage';
import { AdminEvidenceConnectionsPage } from '../features/admin/AdminEvidenceConnectionsPage';
import { AdminEvidenceOperationsPage } from '../features/admin/AdminEvidenceOperationsPage';

// Shared
import { WorkflowHistoryPage } from '../features/workflow/WorkflowHistoryPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { EvidenceLinkingPage } from '../features/settings/EvidenceLinkingPage';
import { AssignLinksPage } from '../features/settings/AssignLinksPage';
import { AdminCheckingResultsPage } from '../features/admin/AdminCheckingResultsPage';
import { NotFoundPage } from '../features/auth/NotFoundPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { AdminTeamAnalyticsPage } from '../features/admin/AdminTeamAnalyticsPage';
import { AdminWorkflowControlPage } from '../features/admin/AdminWorkflowControlPage';
import { AdminSystemHealthPage } from '../features/admin/AdminSystemHealthPage';
import { GlobalTrackerPage } from '../features/admin/GlobalTrackerPage';

export const router = createBrowserRouter([
  // Public Landing & Auth Routes
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/pledge',
    element: <ProtectedRoute><PledgePage /></ProtectedRoute>,
  },
  {
    path: '/pending-approval',
    element: <ProtectedRoute><PendingApprovalPage /></ProtectedRoute>,
  },

  // Dashboard routing is handled before the shell so role-based redirects are explicit.
  {
    path: '/dashboard',
    element: <ProtectedRoute><DashboardRedirect /></ProtectedRoute>,
  },

  // Protected Application Shell
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/profile', element: <ProfilePage /> },
      { path: '/dashboard/evidence-linking', element: <ProtectedRoute requiredModule="evidence"><EvidenceLinkingPage /></ProtectedRoute> },
      { path: '/dashboard/evidence', element: <Navigate to="/dashboard/evidence-linking" replace /> },
      { path: '/dashboard/evidence-performance', element: <Navigate to="/dashboard/evidence-linking" replace /> },
      { path: '/evidence/assignments', element: <ProtectedRoute requiredModule="evidence"><AssignLinksPage /></ProtectedRoute> },
      { path: '/admin/evidence-performance', element: <Navigate to="/dashboard/evidence-linking" replace /> },
      { path: '/admin/checking-results', element: <ProtectedRoute requireAdmin><AdminCheckingResultsPage /></ProtectedRoute> },
      { path: '/dashboard/get-links', element: <ProtectedRoute requiredModule="evidence"><AssignLinksPage /></ProtectedRoute> },
      { path: '/evidence', element: <Navigate to="/dashboard/evidence-linking" replace /> },
      { path: '/evidence/dashboard', element: <Navigate to="/dashboard/evidence-linking" replace /> },
      { path: '/evidence/performance', element: <Navigate to="/dashboard/evidence-linking" replace /> },
      { path: '/evidence/get-links', element: <ProtectedRoute requiredModule="evidence"><AssignLinksPage /></ProtectedRoute> },
      { path: '/admin/evidence-connections', element: <ProtectedRoute requireAdmin><AdminEvidenceConnectionsPage /></ProtectedRoute> },
      { path: '/admin/evidence-operations', element: <ProtectedRoute requireAdmin><AdminEvidenceOperationsPage /></ProtectedRoute> },
      // Searching Team Module
      {
        path: '/searching',
        element: <Navigate to="/searching/import" replace />,
      },
      {
        path: '/searching/import',
        element: (
          <ProtectedRoute requiredModule="searching">
            <SearchingImportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/searching/profiles',
        element: (
          <ProtectedRoute requireAdmin>
            <SearchingProfilesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/searching/posts',
        element: (
          <ProtectedRoute requireAdmin>
            <SearchingPostsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/searching/duplicates',
        element: (
          <ProtectedRoute requireAdmin>
            <SearchingDuplicatesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/searching/handoff',
        element: (
          <ProtectedRoute requireAdmin>
            <SearchingHandoffPage />
          </ProtectedRoute>
        ),
      },

      // Checking Team Module
      {
        path: '/checking',
        element: (
          <ProtectedRoute requiredModule="checking">
            <CheckingDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: '/checking/queue',
        element: <Navigate to="/checking" replace />,
      },
      {
        path: '/checking/record/:id',
        element: (
          <ProtectedRoute requiredModule="checking">
            <CheckingRecordPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/checking/verified',
        element: <Navigate to="/checking" replace />,
      },
      {
        path: '/checking/failed',
        element: <Navigate to="/checking" replace />,
      },

      // Report Generator Module
      {
        path: '/reports',
        element: (
          <ProtectedRoute requireAdmin>
            <ReportsDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports/new',
        element: (
          <ProtectedRoute requireAdmin>
            <NewReportAnalysisPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/reports/jobs',
        element: (
          <ProtectedRoute requireAdmin>
            <ReportsDashboard />
          </ProtectedRoute>
        ),
      },

      // Organization reports are separate from the admin-only ZIP Report Generator.
      { path: '/admin/gender-teams', element: <ProtectedRoute><ErrorBoundary fallbackTitle="Dashboard Error" fallbackMessage="The gender team dashboard encountered an error."><GenderTeamDashboardPage /></ErrorBoundary></ProtectedRoute> },
      { path: '/workspace/reports', element: <ProtectedRoute><OrganizationReportsPage /></ProtectedRoute> },
      { path: '/shared-reports', element: <Navigate to="/workspace/reports" replace /> },

      // Activity & History
      {
        path: '/activity',
        element: <ProtectedRoute requireAdmin><WorkflowHistoryPage /></ProtectedRoute>,
      },

      // Administration Panel
      {
        path: '/admin',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      { path: '/admin/links', element: <ProtectedRoute requireAdmin><AdminLinksPage /></ProtectedRoute> },
      { path: '/admin/global-tracker', element: <ProtectedRoute requireAdmin><GlobalTrackerPage /></ProtectedRoute> },
      { path: '/admin/analytics', element: <ProtectedRoute requireAdmin><AdminTeamAnalyticsPage /></ProtectedRoute> },
      { path: '/admin/workflow-control', element: <ProtectedRoute requireAdmin><AdminWorkflowControlPage /></ProtectedRoute> },
      { path: '/admin/system-health', element: <ProtectedRoute requireAdmin><AdminSystemHealthPage /></ProtectedRoute> },
      { path: '/admin/health', element: <ProtectedRoute requireAdmin><AdminSystemHealthPage /></ProtectedRoute> },
      {
        path: '/admin/tests',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminSystemTestsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/assets',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminAssetsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/admin/duplicates',
        element: (
          <ProtectedRoute requireAdmin>
            <SearchingDuplicatesPage />
          </ProtectedRoute>
        ),
      },

      // System Settings
      {
        path: '/settings',
        element: <ProtectedRoute requireAdmin><SettingsPage /></ProtectedRoute>,
      },
    ],
  },

  // Keep unknown routes visible as route errors instead of silently sending users to the landing page.
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
