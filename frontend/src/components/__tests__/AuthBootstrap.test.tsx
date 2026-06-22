/**
 * AuthBootstrap.test.tsx — covers session-restore on mount and the idle-timeout
 * watchdog.
 *
 * The api layer (authApi), sonner toasts and jwt-decode are mocked so nothing
 * touches the network. The auth store is reset around every test. Timer-driven
 * behaviour (the 30-minute idle logout + 2-minute warning) is exercised with
 * vi.useFakeTimers() and explicit advances; window.location.replace is spied so
 * the test never actually navigates.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useAuthStore } from '../../stores/auth.store';
import { useI18n } from '../../stores/i18n.store';

// --- api layer: only the calls AuthBootstrap reaches on mount ---
const refresh = vi.hoisted(() => vi.fn());
const devLogin = vi.hoisted(() => vi.fn());
vi.mock('../../api/auth.api', () => ({
  authApi: { refresh, devLogin },
}));

// --- toasts: assert which session message fires, no DOM portal needed ---
const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

// --- jwt-decode: AuthBootstrap decodes the access token to seed the user ---
vi.mock('jwt-decode', () => ({
  jwtDecode: () => ({ sub: 'user-1', email: 'admin@dsf.de' }),
}));

import { AuthBootstrap } from '../AuthBootstrap';

const IDLE_MS = 30 * 60 * 1000;
const WARNING_AT = IDLE_MS - 2 * 60 * 1000; // 28 minutes

function child() {
  return <div data-testid="app-content">app loaded</div>;
}

describe('AuthBootstrap', () => {
  beforeEach(() => {
    refresh.mockReset();
    devLogin.mockReset();
    toast.warning.mockReset();
    toast.error.mockReset();
    useAuthStore.getState().clearAuth();
    useI18n.getState().setLang('en');
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
    vi.useRealTimers();
  });

  it('restores the session on mount when the refresh cookie is valid', async () => {
    refresh.mockResolvedValue({ data: { data: { accessToken: 'fresh.access.token' } } });

    renderWithProviders(<AuthBootstrap>{child()}</AuthBootstrap>);

    // While restoring, the placeholder is shown, not the children.
    expect(screen.getByText('Restoring session…')).toBeInTheDocument();
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();

    // Once refresh resolves, children render and the store is authenticated.
    expect(await screen.findByTestId('app-content', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('fresh.access.token');
    expect(useAuthStore.getState().user).toEqual({ id: 'user-1', email: 'admin@dsf.de' });
  });

  it('falls through to the app unauthenticated when refresh and dev-login both fail', async () => {
    refresh.mockRejectedValue(new Error('no cookie'));
    devLogin.mockRejectedValue(new Error('dev-login disabled'));

    renderWithProviders(<AuthBootstrap>{child()}</AuthBootstrap>);

    // It still ends up ready (renders children) but no session was established.
    expect(await screen.findByTestId('app-content', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('skips the refresh round-trip when a session is already in memory', async () => {
    useAuthStore.getState().setTokens('already.here', { id: 'u9', email: 'already@dsf.de' });

    renderWithProviders(<AuthBootstrap>{child()}</AuthBootstrap>);

    // Renders immediately and never hits the refresh endpoint.
    expect(await screen.findByTestId('app-content', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('logs out after 30 minutes idle and warns 2 minutes before', async () => {
    vi.useFakeTimers();
    // jsdom's window.location.replace is non-configurable, so swap in a stub.
    const realLocation = window.location;
    const replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, replace: replaceSpy },
    });

    // Seed an authenticated session so the bootstrap effect short-circuits and
    // the idle watchdog effect arms its timers synchronously.
    useAuthStore.getState().setTokens('session.token', { id: 'u1', email: 'admin@dsf.de' });

    renderWithProviders(<AuthBootstrap>{child()}</AuthBootstrap>);

    // Just before the warning window: nothing has fired yet.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1000);
    });
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();

    // Cross the 28-minute mark: the "expiring soon" warning fires once.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(useI18n.getState().t('sessionExpiring'));
    expect(toast.error).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();

    // Reach the full 30-minute idle timeout: session is cleared, error toast,
    // and a redirect to /login is issued.
    act(() => {
      vi.advanceTimersByTime(IDLE_MS - WARNING_AT);
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(useI18n.getState().t('sessionExpired'));
    expect(replaceSpy).toHaveBeenCalledWith('/login');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('user activity resets the idle timer so the timeout does not fire early', async () => {
    vi.useFakeTimers();
    const realLocation = window.location;
    const replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, replace: replaceSpy },
    });
    useAuthStore.getState().setTokens('session.token', { id: 'u1', email: 'admin@dsf.de' });

    renderWithProviders(<AuthBootstrap>{child()}</AuthBootstrap>);

    // Almost at the warning point, then a keydown resets the timers.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1000);
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });

    // Advancing past the *original* timeout must NOT log out — the clock restarted.
    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // The warning is due 28 minutes after the reset.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(toast.warning).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });
});
