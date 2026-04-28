/**
 * router.tsx – React Router v6 configuration
 * Public routes: /login, /otp, /totp-setup, /totp
 * Protected routes: /app (canvas), /app/audit
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage }     from './pages/LoginPage';
import { OtpPage }       from './pages/OtpPage';
import { TotpSetupPage } from './pages/TotpSetupPage';
import { TotpPage }      from './pages/TotpPage';
import { AppPage }       from './pages/AppPage';
import { AuditPage }     from './pages/AuditPage';
import { AdminPage }     from './pages/AdminPage';
import { AdminHelpPage } from './pages/AdminHelpPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { StatusPage }    from './pages/StatusPage';
import { MapPage }       from './pages/MapPage';
import { NotFoundPage }  from './pages/NotFoundPage';
import { useAuthStore }  from './stores/auth.store';
import { CrossUserGuardProvider } from './components/layout/CrossUserGuardProvider';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/app' : '/login'} replace />;
}

export const router = createBrowserRouter([
  { path: '/',           element: <RootRedirect /> },
  { path: '/login',      element: <LoginPage /> },
  { path: '/otp',        element: <OtpPage /> },
  { path: '/totp-setup', element: <TotpSetupPage /> },
  { path: '/totp',       element: <TotpPage /> },
  {
    path: '/app',
    element: <RequireAuth><CrossUserGuardProvider><AppPage /></CrossUserGuardProvider></RequireAuth>,
    children: [
      { index: true, element: null },
      { path: 'audit', element: <AuditPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'admin/help', element: <AdminHelpPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
      { path: 'status', element: <StatusPage /> },
      { path: 'map', element: <MapPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
