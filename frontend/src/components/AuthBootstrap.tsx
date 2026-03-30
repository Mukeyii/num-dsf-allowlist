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
import { toast } from 'sonner';
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

  // Idle timeout – 30 minutes of inactivity triggers logout
  useEffect(() => {
    if (!isAuthenticated) return;

    const IDLE_MS = 30 * 60 * 1000; // 30 minutes
    const WARNING_MS = 2 * 60 * 1000; // warn 2 min before
    let idleTimer: ReturnType<typeof setTimeout>;
    let warnTimer: ReturnType<typeof setTimeout>;
    let warningShown = false;

    function resetTimers() {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      warningShown = false;

      warnTimer = setTimeout(() => {
        if (!warningShown) {
          warningShown = true;
          toast.warning('Your session will expire in 2 minutes due to inactivity.');
        }
      }, IDLE_MS - WARNING_MS);

      idleTimer = setTimeout(() => {
        useAuthStore.getState().clearAuth();
        toast.error('Session expired due to inactivity.');
        window.location.replace('/login');
      }, IDLE_MS);
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(event => document.addEventListener(event, resetTimers));
    resetTimers();

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      events.forEach(event => document.removeEventListener(event, resetTimers));
    };
  }, [isAuthenticated]);

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
