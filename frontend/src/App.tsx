import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
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
import SmsSettingsPage from './pages/SmsSettings';
import PlatformDashboardPage from './pages/PlatformDashboard';
import PlatformOrganizationsPage from './pages/PlatformOrganizations';
import PlatformPlansPage from './pages/PlatformPlans';
import PlatformRolesPage from './pages/PlatformRoles';

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

/** Renders the analytics dashboard for managers/admins, or the action landing page for everyone else. */
function HomePage() {
  const { hasPermission, isPlatformAdmin } = useAuth();
  if (isPlatformAdmin) return <PlatformDashboardPage />;
  return hasPermission('REPORT_VIEW') ? <DashboardPage /> : <LandingPage />;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<HomePage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings/notifications" element={<NotificationSettingsPage />} />
        <Route path="settings/organization" element={<OrganizationSettingsPage />} />
        <Route path="settings/email" element={<EmailSettingsPage />} />
        <Route path="settings/sms" element={<SmsSettingsPage />} />
        <Route path="platform" element={<PlatformDashboardPage />} />
        <Route path="platform/organizations" element={<PlatformOrganizationsPage />} />
        <Route path="platform/organizations/:organizationId/roles" element={<PlatformRolesPage />} />
        <Route path="platform/plans" element={<PlatformPlansPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
