/**
 * TotpSetupPage.test.tsx — renders the first-login TOTP setup (QR step).
 * setupTotp is mocked to resolve a QR URL; tempToken comes from location state.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('../../api/auth.api', () => ({
  authApi: {
    setupTotp: vi.fn().mockResolvedValue({ data: { data: { qrCodeUrl: 'data:image/png;base64,AAA' } } }),
    confirmTotp: vi.fn().mockResolvedValue({ data: { data: { accessToken: 'x', backupCodes: [] } } }),
  },
}));

import { TotpSetupPage } from '../TotpSetupPage';

describe('TotpSetupPage', () => {
  it('renders the setup heading and loads the QR code', async () => {
    renderWithProviders(<TotpSetupPage />, {
      route: { pathname: '/totp-setup', state: { tempToken: 'temp-123' } },
    });
    expect(screen.getByText('Set up two-factor authentication')).toBeInTheDocument();
    expect(await screen.findByAltText('TOTP QR Code')).toBeInTheDocument();
  });
});
