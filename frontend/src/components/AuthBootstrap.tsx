/**
 * AuthBootstrap.tsx – Tries to restore session on page load.
 *
 * On mount, calls POST /auth/refresh (browser sends httpOnly cookie automatically).
 * If the refresh token cookie is valid → new access token → user stays logged in.
 * If not → no-op, user sees login page.
 *
 * SECURITY: Access token still only in memory (Zustand). Never localStorage.
 * The refresh token is httpOnly — JS can't read it, browser sends it automatically.
 */
import { useEffect, useState, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../stores/auth.store';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // Already authenticated (e.g. just logged in, no refresh needed)
    if (isAuthenticated) {
      setReady(true);
      return;
    }

    // Try to restore session via refresh token cookie
    authApi.refresh()
      .then((res) => {
        const accessToken = res.data.data.accessToken;
        const decoded: any = jwtDecode(accessToken);
        useAuthStore.getState().setTokens(accessToken, {
          id: decoded.sub,
          email: decoded.email,
        });
      })
      .catch(() => {
        // No valid refresh token — user needs to log in
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f8',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <span
            style={{ fontSize: '24px', fontWeight: 700, color: '#6c63ff', letterSpacing: '-0.5px' }}
          >
            dsf.
          </span>
          <p style={{ fontSize: '12px', color: '#9b9fad', marginTop: '8px' }}>
            Restoring session…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
