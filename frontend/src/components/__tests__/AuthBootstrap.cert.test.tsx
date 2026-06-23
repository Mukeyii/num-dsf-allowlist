import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

const refresh = vi.fn();
const clientCertLogin = vi.fn();
vi.mock('../../api/auth.api', () => ({
  authApi: {
    refresh: () => refresh(),
    clientCertLogin: () => clientCertLogin(),
    devLogin: vi.fn(),
  },
}));

import { AuthBootstrap } from '../AuthBootstrap';

beforeEach(() => {
  vi.stubEnv('VITE_AUTH_MODE', 'cert');
  refresh.mockReset();
  clientCertLogin.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AuthBootstrap (cert mode)', () => {
  it('renders the cert-status screen when cert login is rejected', async () => {
    refresh.mockRejectedValue(new Error('no session'));
    clientCertLogin.mockRejectedValue({
      response: { data: { error: { code: 'CERT_NOT_REGISTERED' } } },
    });
    renderWithProviders(
      <AuthBootstrap>
        <div>APP CONTENT</div>
      </AuthBootstrap>,
    );
    await waitFor(() => expect(screen.getByText(/not in the allow-list/i)).toBeInTheDocument());
    expect(screen.queryByText('APP CONTENT')).not.toBeInTheDocument();
  });

  it('renders children when cert login succeeds', async () => {
    refresh.mockRejectedValue(new Error('no session'));
    // a minimal three-part token; jwtDecode only base64-decodes the payload part.
    const payload = btoa(JSON.stringify({ sub: 'u1', email: 'site@example.de' }));
    clientCertLogin.mockResolvedValue({
      data: { data: { accessToken: `x.${payload}.x`, email: 'site@example.de' } },
    });
    renderWithProviders(
      <AuthBootstrap>
        <div>APP CONTENT</div>
      </AuthBootstrap>,
    );
    await waitFor(() => expect(screen.getByText('APP CONTENT')).toBeInTheDocument());
  });
});
