import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import { OrgUserAccountPage, PlatformUserAccountPage } from './pages/UserAccountPage';
import LandingPage from './pages/Landing';
import DashboardPage from './pages/Dashboard';
import TicketsPage from './pages/Tickets';
import TicketDetailPage from './pages/TicketDetail';
import AssetsPage from './pages/Assets';
import LocationsPage from './pages/Locations';
import UsersPage from './pages/Users';
import ReportsPage from './pages/Reports';
import NotificationSettingsPage from './pages/NotificationSettings';
import OrganizationSettingsPage from './pages/OrganizationSettings';
import EmailSettingsPage from './pages/EmailSettings';
import PushSettingsPage from './pages/PushSettings';
import PlatformDashboardPage from './pages/PlatformDashboard';
import PlatformOrganizationsPage from './pages/PlatformOrganizations';
import PlatformPlansPage from './pages/PlatformPlans';
import PlatformRolesPage from './pages/PlatformRoles';
import PlatformOrgDetailPage from './pages/PlatformOrgDetail';
import PlatformAuditLogPage from './pages/PlatformAuditLog';
import PlatformSystemConfigPage from './pages/PlatformSystemConfig';
import PlatformMobileReleasePage from './pages/PlatformMobileRelease';
import GroupsPage from './pages/Groups';
import AppUpdateGate from './components/AppUpdateGate';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center max-w-md px-6">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">{this.state.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.href = '/'; }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Return to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { token, isPlatformAdmin } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Renders the analytics dashboard for managers/admins, or the action landing page for everyone else. */
function HomePage() {
  const { hasPermission, isPlatformAdmin } = useAuth();
  if (isPlatformAdmin) return <Navigate to="/platform" replace />;
  return hasPermission('REPORT_VIEW') ? <DashboardPage /> : <LandingPage />;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={token ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<HomePage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/new" element={<OrgUserAccountPage />} />
        <Route path="users/:userId/edit" element={<OrgUserAccountPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings/notifications" element={<NotificationSettingsPage />} />
        <Route path="settings/organization" element={<OrganizationSettingsPage />} />
        <Route path="settings/email" element={<EmailSettingsPage />} />
        <Route path="settings/push" element={<PushSettingsPage />} />
        <Route path="groups" element={<GroupsPage />} />
      </Route>
      <Route path="/platform" element={<PlatformAdminRoute><AdminLayout /></PlatformAdminRoute>}>
        <Route index element={<PlatformDashboardPage />} />
        <Route path="organizations" element={<PlatformOrganizationsPage />} />
        <Route path="organizations/:id" element={<PlatformOrgDetailPage />} />
        <Route path="organizations/:organizationId/users/new" element={<PlatformUserAccountPage />} />
        <Route path="organizations/:organizationId/users/:userId/edit" element={<PlatformUserAccountPage />} />
        <Route path="organizations/:organizationId/roles" element={<PlatformRolesPage />} />
        <Route path="plans" element={<PlatformPlansPage />} />
        <Route path="audit" element={<PlatformAuditLogPage />} />
        <Route path="system-config" element={<PlatformSystemConfigPage />} />
        <Route path="mobile-release" element={<PlatformMobileReleasePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppUpdateGate>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AppUpdateGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}
