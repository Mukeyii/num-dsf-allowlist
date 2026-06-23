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
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useI18n } from '../stores/i18n.store';
import { useAuthStore } from '../stores/auth.store';
import { isCertMode, reauthRedirect } from '../lib/authMode';
import { CertStatusPage } from '../pages/CertStatusPage';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  // undefined = not in cert-error state; null = checking; string = backend error code
  const [certError, setCertError] = useState<string | null | undefined>(undefined);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Dev-only URL shortcut: ?devRole=admin|member forces a fresh dev-login.
    // Overrides any existing session so you can switch roles by URL.
    const devRole = import.meta.env.DEV
      ? (new URLSearchParams(window.location.search).get('devRole') as
          | 'admin'
          | 'member'
          | 'site'
          | null)
      : null;

    async function devLoginAs(role: 'admin' | 'member' | 'site' | undefined) {
      const dev = await authApi.devLogin(role);
      const accessToken = dev.data.data.accessToken;
      const decoded: any = jwtDecode(accessToken);
      useAuthStore.getState().setTokens(accessToken, {
        id: decoded.sub,
        email: decoded.email,
      });
      // Drop any cache from a prior session (esp. ['me']) so role/admin status
      // refetches with the new token instead of returning stale isAdmin=false.
      queryClient.clear();
    }

    if (devRole) {
      useAuthStore.getState().clearAuth();
      queryClient.clear();
      devLoginAs(devRole)
        .catch(() => {
          /* dev-login disabled — fall through to login page */
        })
        .finally(() => setReady(true));
      return;
    }

    if (useAuthStore.getState().isAuthenticated) {
      setReady(true);
      return;
    }

    // Try to restore session via refresh token cookie.
    // On failure in a Vite dev build, try DEV_AUTO_LOGIN as a last-resort
    // shortcut. The backend refuses unless NODE_ENV !== 'production' AND
    // DEV_AUTO_LOGIN === 'true', so this is a no-op in production.
    authApi
      .refresh()
      .then((res) => {
        const accessToken = res.data.data.accessToken;
        const decoded: any = jwtDecode(accessToken);
        useAuthStore.getState().setTokens(accessToken, {
          id: decoded.sub,
          email: decoded.email,
        });
        queryClient.clear();
      })
      .catch(async () => {
        if (isCertMode()) {
          setCertError(null); // show the "checking" state while we try the cert
          try {
            const res = await authApi.clientCertLogin();
            const accessToken = res.data.data.accessToken;
            const decoded: any = jwtDecode(accessToken);
            useAuthStore.getState().setTokens(accessToken, {
              id: decoded.sub,
              email: decoded.email,
            });
            queryClient.clear();
            setCertError(undefined);
          } catch (e: any) {
            setCertError(e?.response?.data?.error?.code ?? 'UNKNOWN');
          }
          return;
        }
        if (!import.meta.env.DEV) return;
        try {
          await devLoginAs(undefined);
        } catch {
          /* dev-login disabled — fall through to login page */
        }
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
          toast.warning(useI18n.getState().t('sessionExpiring'));
        }
      }, IDLE_MS - WARNING_MS);

      idleTimer = setTimeout(() => {
        useAuthStore.getState().clearAuth();
        toast.error(useI18n.getState().t('sessionExpired'));
        reauthRedirect();
      }, IDLE_MS);
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((event) => document.addEventListener(event, resetTimers));
    resetTimers();

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      events.forEach((event) => document.removeEventListener(event, resetTimers));
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
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--primary)',
              letterSpacing: '-0.5px',
            }}
          >
            dsf.
          </span>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Restoring session…
          </p>
        </div>
      </div>
    );
  }

  if (certError !== undefined) {
    return <CertStatusPage code={certError} />;
  }

  return <>{children}</>;
}
