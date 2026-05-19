import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../Layout';
import PublicLayout from './PublicLayout';

const PUBLIC_PATHS = new Set(['/', '/features', '/pricing', '/privacy', '/terms']);

export default function AppShell() {
  const { token } = useAuth();
  const location = useLocation();
  const isPublicPage = PUBLIC_PATHS.has(location.pathname);

  if (!token) {
    if (isPublicPage) {
      return <PublicLayout />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Layout />;
}
