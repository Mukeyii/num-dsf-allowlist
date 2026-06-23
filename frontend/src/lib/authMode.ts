/**
 * authMode.ts — single source of truth for the build-time auth mode.
 * VITE_AUTH_MODE=cert enables the login-screen-free, client-certificate
 * deployment variant (see ADR-005). Absent/anything else = the default OTP flow.
 */
export function isCertMode(): boolean {
  return import.meta.env.VITE_AUTH_MODE === 'cert';
}

/**
 * Where to send the browser after a lost/expired session. In cert mode there is
 * no login screen — a full reload to `/` re-runs AuthBootstrap, which re-attempts
 * the client-cert login. In OTP mode, go to the login page.
 */
export function reauthRedirect(): void {
  window.location.replace(isCertMode() ? '/' : '/login');
}
