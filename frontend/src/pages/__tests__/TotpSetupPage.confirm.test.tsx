/**
 * TotpSetupPage.confirm.test.tsx — exercises the confirm/backup flow that the
 * sibling TotpSetupPage.test.tsx does not: advancing from QR → confirm step,
 * typing the 6-digit code, submitting (confirmTotp mutation, mocked), the
 * success path that renders backup codes, and the invalid-code error branch.
 *
 * jwt-decode is mocked so the success path stays deterministic without a real
 * JWT. authApi is mocked per-test so no network is touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { useAuthStore } from '../../stores/auth.store';

const setupTotp = vi.fn();
const confirmTotp = vi.fn();

vi.mock('../../api/auth.api', () => ({
  authApi: {
    setupTotp: (...args: unknown[]) => setupTotp(...args),
    confirmTotp: (...args: unknown[]) => confirmTotp(...args),
  },
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: () => ({ sub: 'user-1', email: 'admin@example.org' }),
}));

import { TotpSetupPage } from '../TotpSetupPage';

const ROUTE = { pathname: '/totp-setup', state: { tempToken: 'temp-123' } };

async function gotoConfirmStep() {
  const user = userEvent.setup();
  setupTotp.mockResolvedValue({ data: { data: { qrCodeUrl: 'data:image/png;base64,AAA' } } });
  renderWithProviders(<TotpSetupPage />, { route: ROUTE });
  // Wait for the QR to load, then advance to the confirm step.
  await screen.findByAltText('TOTP QR Code', {}, { timeout: 4000 });
  await user.click(screen.getByRole('button', { name: "I've scanned the QR code →" }));
  expect(await screen.findByText('Verify your authenticator')).toBeInTheDocument();
  return user;
}

describe('TotpSetupPage — confirm + backup flow', () => {
  beforeEach(() => {
    setupTotp.mockReset();
    confirmTotp.mockReset();
    useAuthStore.getState().clearAuth();
  });

  it('advances from the QR step to the confirm step on button click', async () => {
    await gotoConfirmStep();
    expect(
      screen.getByText('Enter the 6-digit code from your authenticator app to complete setup.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('keeps the submit button disabled until 6 digits are entered', async () => {
    const user = await gotoConfirmStep();
    const submit = screen.getByRole('button', { name: 'Complete setup →' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole('textbox'), '123');
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole('textbox'), '456');
    expect(submit).toBeEnabled();
  });

  it('strips non-digit characters from the code input', async () => {
    const user = await gotoConfirmStep();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '12ab34');
    expect(input.value).toBe('1234');
  });

  it('submits the code, calls confirmTotp, stores tokens and shows backup codes', async () => {
    confirmTotp.mockResolvedValue({
      data: { data: { accessToken: 'jwt-token', backupCodes: ['AAA-111', 'BBB-222'] } },
    });
    const user = await gotoConfirmStep();

    await user.type(screen.getByRole('textbox'), '654321');
    await user.click(screen.getByRole('button', { name: 'Complete setup →' }));

    await waitFor(() => expect(confirmTotp).toHaveBeenCalledWith('temp-123', '654321'), {
      timeout: 4000,
    });

    // Backup step renders the returned codes.
    expect(
      await screen.findByText('Save your backup codes', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('AAA-111')).toBeInTheDocument();
    expect(screen.getByText('BBB-222')).toBeInTheDocument();

    // Decoded token landed in the auth store.
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe('jwt-token');
      expect(state.user).toEqual({ id: 'user-1', email: 'admin@example.org' });
    });
  });

  it('shows the invalid-code error and clears the field when confirmTotp rejects', async () => {
    confirmTotp.mockRejectedValue(new Error('bad code'));
    const user = await gotoConfirmStep();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '000000');
    await user.click(screen.getByRole('button', { name: 'Complete setup →' }));

    expect(
      await screen.findByText('Invalid code. Try again.', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    // On failure the code is reset and we stay on the confirm step.
    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.getByText('Verify your authenticator')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('redirects to login when no tempToken is present in router state', async () => {
    renderWithProviders(<TotpSetupPage />, { route: { pathname: '/totp-setup' } });
    // No QR loads; setupTotp is never called because tempToken is missing.
    await waitFor(() => expect(setupTotp).not.toHaveBeenCalled());
    expect(screen.queryByAltText('TOTP QR Code')).not.toBeInTheDocument();
  });
});
